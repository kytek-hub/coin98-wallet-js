import { Client } from '@xchainjs/xchain-cosmos'
import { baseAmount } from '@xchainjs/xchain-util'
import { convertBalanceToWei } from '../../common/utils'

class CosmosServices {
  constructor ({ network = 'mainnet' }) {
    this.chain = 'cosmos'
    this.client = new Client({ network })
    this.decimal = 6
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
  }

  async getBalance ({ address, asset = 'rune' }) {
    try {
      const balances = await this.client.getBalance(address)
      const balance = balances.find(it => it.demom.toUpperCase() === asset.toUpperCase()) || 0
      return balance
    } catch (e) {
      return 0
    }
  }

  async transfer ({
    toAddress,
    amount,
    asset,
    mnemonic,
    memo = '',
    fee = {
      amount: [],
      gas: '200000'
    }
  }) {
    try {
      const amountWei = convertBalanceToWei(amount, this.decimal)
      this.client.setPhrase(mnemonic)
      const resp = await this.client.transfer({
        asset: { chain: 'COSMOS', symbol: 'ATOM', ticker: 'ATOM' },
        amount: baseAmount(amountWei, this.decimal),
        recipient: toAddress,
        memo
      })
      return resp
    } catch (e) {
      throw new Error(e)
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
