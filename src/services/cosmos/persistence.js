import { Cosmos } from '@cosmostation/cosmosjs'
import message from '@cosmostation/cosmosjs/src/messages/proto'
import axios from 'axios'
import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'

class PersistenceServices {
  constructor ({ network = 'mainnet' }) {
    this.chain = 'persistence'
    this.chainId = 'core-1'
    this.client = new Cosmos(this._getNetwork(), this.chainId)
    this.decimal = 6
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
  }

  async getBalance ({ address, asset = 'uxprt' }) {
    try {
      const api = this._getNetwork() + `/cosmos/bank/v1beta1/balances/${address}`
      const response = await axios.get(api)
      const { balances } = response.data
      const balance = balances.find(it => it.denom === asset) || { amount: 0 }
      return convertWeiToBalance(balance.amount, this.decimal)
    } catch (e) {
      console.log('error', e)
      return 0
    }
  }

  async transfer ({
    toAddress,
    amount,
    asset = 'uxprt',
    mnemonic,
    memo = '',
    fee = {
      amount: [{ denom: 'uxprt', amount: String(5000) }],
      gas: '200000'
    }
  }) {
    try {
      const amountWei = convertBalanceToWei(amount, this.decimal)
      const cosmos = this.client

      cosmos.setPath("m/44'/750'/0'/0/0")
      cosmos.setBech32MainPrefix('persistence')

      const address = cosmos.getAddress(mnemonic)
      const privKey = cosmos.getECPairPriv(mnemonic)
      const pubKeyAny = cosmos.getPubKeyAny(privKey)
      const accounts = await (await fetch(this._getNetwork() + `/auth/accounts/${address}`)).json()
      const feeTxs = 50

      if (accounts) {
        const { account_number: accountNumber, sequence = String(0) } = accounts.result.value

        const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
          from_address: address,
          to_address: toAddress,
          amount: [{ denom: asset, amount: String(amountWei) }]
        })

        const msgSendAny = new message.google.protobuf.Any({
          type_url: '/cosmos.bank.v1beta1.MsgSend',
          // type: '',
          value: message.cosmos.bank.v1beta1.MsgSend.encode(msgSend).finish()
        })

        const txBody = new message.cosmos.tx.v1beta1.TxBody({
          messages: [msgSendAny],
          memo
        })

        const signerInfo = new message.cosmos.tx.v1beta1.SignerInfo({
          public_key: pubKeyAny,
          mode_info: {
            single: {
              mode: message.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT
            }
          },
          sequence
        })

        const feeValue = new message.cosmos.tx.v1beta1.Fee({
          amount: [{ denom: asset, amount: String(feeTxs) }],
          gas_limit: 200000
        })

        const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({
          signer_infos: [signerInfo],
          fee: feeValue
        })

        const signedTxBytes = cosmos.sign(
          txBody,
          authInfo,
          accountNumber,
          privKey
        )

        const broadcastObj = {
          id: 1,
          jsonrpc: '2.0',
          method: 'broadcast_tx_sync',
          params: {
            tx: Buffer.from(signedTxBytes, 'binary').toString('base64')
          }
        }

        const { data: response } = await axios.post('https://rpc.core.persistence.one/', broadcastObj, {
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.result.hash) {
          throw new Error(response.result.log)
        }

        return response.result.hash
      }
    } catch (e) {
      console.log('transfer error', e)
    }
  }

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://rest.core.persistence.one/'
    }
    return 'https://rest.core.persistence.one/'
  }
}

export default PersistenceServices
