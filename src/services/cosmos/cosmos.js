import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'

import axios from 'axios'

class CosmosServices {
  constructor ({ network = 'mainnet' }) {
    this.chain = 'cosmos'
    this.chainId = 'cosmoshub-4'
    this.decimal = 6
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
  }

  async getBalance ({ address, asset = 'uatom' }) {
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
    asset = 'uatom',
    mnemonic,
    memo = '',
    fee = {
      amount: [{ denom: 'uatom', amount: String(50) }],
      gas: '200000'
    }
  }) {
    try {
      const message = await import('@cosmostation/cosmosjs/src/messages/proto')
      const { Cosmos } = await import('@cosmostation/cosmosjs')
      const amountWei = convertBalanceToWei(amount, this.decimal)
      const cosmos = new Cosmos(this._getNetwork(), this.chainId)
      const address = cosmos.getAddress(mnemonic)
      const privKey = cosmos.getECPairPriv(mnemonic)
      const pubKeyAny = cosmos.getPubKeyAny(privKey)
      const accounts = await cosmos.getAccounts(address)

      const feeTxs = 50

      if (accounts) {
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
          sequence: accounts.account.sequence
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
          accounts.account.account_number,
          privKey
        )

        const { tx_response: response } = await cosmos.broadcast(signedTxBytes)

        if (response.raw_log.length > 5) {
          throw new Error(response.raw_log)
        }

        return response.txhash || response.hash
      }
    } catch (e) {
      console.log('transfer error', e)
    }
  }

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://lcd-cosmos-app.cosmostation.io'
    }
    return 'http://lcd.gaia.bigdipper.live:1317'
  }
}

export default CosmosServices
