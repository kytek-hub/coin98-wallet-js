import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'

import { Client, Message, Transaction, Wallet } from '@bandprotocol/bandchain.js'

const { MsgSend } = Message
// const { Coin } = Data
const { PrivateKey, Address } = Wallet

class BandServices {
  constructor ({ network }) {
    this.chain = 'band'
    this.network = this._getNetwork(network)
    this.client = new Client(this.network)
    this.decimal = 9

    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getNetwork = this._getNetwork.bind(this)
  }

  async getBalance ({ address, assets = 'uband' }) {
    try {
      const account = await this.client.getAccount(Address.fromAccBech32(address))

      const coins = account.coins || []

      const findAsset = coins.find(it => it.denom.toUpperCase() === assets.toUpperCase())

      const balance = findAsset ? findAsset.amount : 0

      if (balance) {
        return convertWeiToBalance(balance, this.decimal)
      }
      return 0
    } catch (e) {
      return 0
    }
  }

  async transfer ({
    toAddress,
    mnemonic,
    amount,
    memo = '',
    asset = 'uband'
  }) {
    try {
      const privKey = PrivateKey.fromMnemonic(mnemonic)
      const pubKey = privKey.toPubkey()
      const fromAddress = pubKey.toAddress()

      // Fetch Accounts
      const account = await this.client.getAccount(Address.fromAccBech32(fromAddress))

      const fAmount = convertBalanceToWei(amount, this.decimal)
      const coins = [{
        denom: String(asset),
        amount: String(fAmount)
      }]

      const msgSend = new MsgSend(
        Address.fromAccBech32(fromAddress),
        Address.fromAccBech32(toAddress),
        coins
      )

      const tsc = new Transaction().withMessages(msgSend).withAccountNum(account.accountNumber).withSequence(account.sequence).withChainID('bandchain').withGas(200000)

      const rawData = tsc.getSignData()
      const signature = privKey.sign(rawData)
      const rawTx = tsc.getTxData(signature, pubKey)
      const txtHash = await this.client.sendTxSyncMode(rawTx)
      return txtHash
    } catch (e) {
      throw new Error(e)
    }
  }

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://api-gm-lb.bandchain.org'
    }
    return 'https://api-gm-lb.bandchain.org'
  }
}

export default BandServices
