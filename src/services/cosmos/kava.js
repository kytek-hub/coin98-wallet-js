import * as Kava from '@kava-labs/javascript-sdk'

const KAVA_CONVERSION_FACTOR = 10 ** 6
class KavaServices {
  constructor ({ network }) {
    this.chain = 'kava'
    this.network = this._getNetwork(network)
    this.client = new Kava.KavaClient(this.network)

    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getNetwork = this._getNetwork.bind(this)
  }

  async getBalance ({ address, assets = 'ukava' }) {
    try {
      const balances = await this.client.getBalances(address, 10000)

      const balance = balances.find(it => it.denom.toUpperCase() === assets.toUpperCase())
      if (balance) {
        return balance.amount / KAVA_CONVERSION_FACTOR
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
    asset = 'ukava'
  }) {
    try {
      this.client.setWallet(mnemonic)
      this.client.setBroadcastMode('async')
      await this.client.initChain()

      const fAmount = parseFloat(amount) * KAVA_CONVERSION_FACTOR
      const coins = [{
        denom: String(asset),
        amount: String(fAmount)
      }]
      const txtHash = await this.client.transfer(toAddress, coins)

      return txtHash
    } catch (e) {
      throw new Error(e)
    }
  }

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://api.kava.io'
    }
    return 'https://api.data-testnet-12000.kava.io'
  }
}

export default KavaServices
