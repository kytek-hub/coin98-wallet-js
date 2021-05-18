import { Client } from '@xchainjs/xchain-thorchain'
import { baseAmount } from '@xchainjs/xchain-util'
import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'
class ThorServices {
  constructor ({ network = 'mainnet' }) {
    this.chain = 'thor'
    this.client = new Client({ network })
    this.decimal = 8
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
  }

  async getBalance ({ address, asset = 'rune' }) {
    try {
      const balances = await this.client.getBalance(address)
      return convertWeiToBalance(balances[0].amount.amount(), this.decimal)
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
        asset: { chain: 'THOR', symbol: 'RUNE', ticker: 'RUNE' },
        amount: baseAmount(amountWei, this.decimal),
        recipient: toAddress,
        memo
      })
      return resp
    } catch (e) {
      throw new Error(e)
    }
  }
}

export default ThorServices
