
import get from 'lodash/get'
import axios from 'axios'
import Kava from '@kava-labs/javascript-sdk'
import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'
const sig = require('@kava-labs/sig')

const { msg, tx } = Kava

class CosmosServices {
  constructor ({ network = 'mainnet' }) {
    this.chain = 'kava'
    this.chainId = 'kava-7'
    this.decimal = 6
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
  }

  async getBalance ({ address, assets = 'ukava' }) {
    try {
      const response = await (await fetch(`${this._getNetwork()}/auth/accounts/${address}`)).json()

      const coins = get(response, 'result.value.coins', [])

      const balance = coins.find(it => it.denom.toUpperCase() === assets.toUpperCase())
      if (balance) {
        return convertWeiToBalance(balance.amount, this.decimal)
      }
      return 0
    } catch (e) {
      console.log('kava error', e)
      return 0
    }
  }

  async transfer ({
    toAddress,
    amount,
    asset = 'ukava',
    mnemonic,
    memo = '',
    fee = {
      amount: [{ denom: 'ukava', amount: String(2000) }],
      gas: '200000'
    }
  }) {
    try {
      const amountWei = convertBalanceToWei(amount, this.decimal)
      const wallet = sig.createWalletFromMnemonic(mnemonic, '', 'kava', "m/44'/459'/0'/0/0")
      const address = wallet.address
      const accounts = await (await fetch(this._getNetwork() + `/auth/accounts/${address}`)).json()

      if (accounts) {
        const { account_number: accountNumber, sequence = String(0) } = accounts.result.value

        const msgSend = msg.cosmos.newMsgSend(address, toAddress, [{ denom: asset, amount: String(amountWei) }])
        const rawTx = msg.cosmos.newStdTx([msgSend], fee, memo)

        // Sign info
        let signInfo
        if (accountNumber && sequence) {
          signInfo = {
            chain_id: this.chainId,
            account_number: String(accountNumber),
            sequence: String(sequence)
          }
        } else {
          const meta = await tx.loadMetaData(address, this._getNetwork())
          // Select manually set values over automatically pulled values
          signInfo = {
            chain_id: this.chainId,
            account_number:
            accountNumber != null
              ? String(accountNumber)
              : String(meta.account_number),
            sequence: sequence ? String(sequence) : String(meta.sequence)
          }
        }

        const signedTx = tx.signTx(rawTx, signInfo, wallet)
        const { data: response } = await axios.post(`${this._getNetwork()}/txs`, sig.createBroadcastTx(signedTx.value, 'block'))

        if (response.code) {
          throw new Error(response.raw_log)
        }

        return response.txhash || response.hash
      }
    } catch (e) {
      console.log('Kava transfer Error', e)
    }
  }

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://api.kava.io'
    }
    return 'https://api.kava.io'
  }
}

export default CosmosServices
