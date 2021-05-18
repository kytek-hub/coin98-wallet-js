import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'
import { Client, Message, Data, Transaction, Wallet } from '@bandprotocol/bandchain.js'

const { MsgSend } = Message
const { Coin } = Data
const { PrivateKey, Address } = Wallet

class BandServices {
  constructor ({ network }) {
    this.chain = 'band'
    this.network = this._getNetwork(network)
    this.client = new Client(this.network)
    this.decimal = 6

    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getNetwork = this._getNetwork.bind(this)
  }

  async getBalance ({ address, assets = 'uband' }) {
    try {
      const account = await this.client.getAccount(Address.fromAccBech32(address))

      const coins = account.coins || []

      const findAsset = coins.find(it => it.denom === assets)

      const balance = findAsset ? findAsset.amount : 0

      if (balance) {
        const fBalance = convertWeiToBalance(balance, this.decimal)
        return fBalance
      }
      return 0
    } catch (e) {
      console.log('test', e)
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
      const privKey = PrivateKey.fromMnemonic(mnemonic, "m/44'/494'/0'/0/0")
      const pubKey = privKey.toPubkey()
      const fromAddress = pubKey.toAddress()

      // Fetch Accounts
      const account = await this.client.getAccount(fromAddress)

      const fAmount = convertBalanceToWei(amount, this.decimal)

      const coins = new Coin(parseInt(fAmount), asset)

      const msgSend = new MsgSend(
        fromAddress,
        Address.fromAccBech32(toAddress),
        [coins]
      )

      const chainId = await this.client.getChainID()
      const tsc = new Transaction().withMessages(msgSend).withAccountNum(account.accountNumber).withSequence(account.sequence).withChainID(chainId).withGas(200000)
      const rawData = tsc.getSignData()
      const signature = privKey.sign(rawData)
      const rawTx = tsc.getTxData(signature, pubKey)
      const { txHash } = await this.client.sendTxBlockMode(rawTx)
      return txHash ? txHash.toString('hex') : undefined
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
