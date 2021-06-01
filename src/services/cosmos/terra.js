import { LCDClient, MsgSend, MsgExecuteContract, MnemonicKey } from '@terra-money/terra.js'
import { convertBalanceToWei, convertWeiToBalance, getLength, lowerCase } from '../../common/utils'
import { ApolloClient, InMemoryCache, gql } from '@apollo/client'
import get from 'lodash/get'
class TerraServices {
  constructor ({ network }) {
    this.chain = 'terra-luna'
    this.network = this._getNetwork(network)
    this.client = new LCDClient({
      URL: this._getNetwork(),
      chainID: this._getChainID(),
      gasPrices: { uluna: 0.02 },
      gasAdjustment: 2
    })
    this.decimal = 6
    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getNetwork = this._getNetwork.bind(this)
    this._getChainID = this._getChainID.bind(this)
  }

  async getBalance ({ address, asset = 'uluna', decimal = 6 }) {
    const isNative = this._isNative(asset)
    try {
      if (isNative) {
        const response = await this.client.bank.balance(address)
        const balance = response.get(lowerCase(asset))

        if (!balance) {
          return 0
        }
        const fAmount = convertWeiToBalance(balance.amount, decimal)
        return fAmount
      }
      // not native
      const client = new ApolloClient({
        uri: 'https://mantle.terra.dev',
        cache: new InMemoryCache()
      })

      const result = await client.query({
        query: gql`
        query{
          ${asset}: WasmContractsContractAddressStore(
            ContractAddress:"${asset}"
            QueryMsg:"${JSON.stringify({ balance: { address } }).replace(/"/g, '\\"')}"
          ){
            Height
            Result
          }
        }`
      })
      const fResult = JSON.parse(get(result, `data.${asset}.Result`, '{}'))

      const { balance } = fResult

      return convertWeiToBalance(balance, this.decimal)
    } catch (e) {
      return 0
    }
  }

  async transfer ({
    toAddress,
    mnemonic,
    amount,
    memo = '',
    asset = 'uluna'
  }) {
    try {
      const isNative = this._isNative(asset)

      const mk = new MnemonicKey({ mnemonic })
      // Wallet
      const wallet = this.client.wallet(mk)

      const fAmount = convertBalanceToWei(amount, this.decimal)
      // MSG
      const send = isNative
        ? new MsgSend(
          mk.accAddress,
          toAddress,
          { [asset]: fAmount }
        )

        : new MsgExecuteContract(mk.accAddress, asset, {
          transfer: {
            recipient: toAddress,
            amount: fAmount
          }
        })

      // Calculate Fee && Sign & send
      const signedTx = await wallet.createAndSignTx({
        msgs: [send],
        memo
        // fee
      })

      const { txhash } = await this.client.tx.broadcast(signedTx)
      if (txhash) { return txhash }
      throw new Error('Terra Send Error')
    } catch (e) {
      throw new Error(e)
    }
  }

  // Ulities
  _isNative (denom) {
    return (denom.startsWith('u') && getLength(denom) === 4) || lowerCase(denom) === 'uluna'
  }

  _getChainID (network = 'mainnet') {
    if (network !== 'mainnet') {
      return 'tequila-0004'
    }
    return 'columbus-4'
  }

  _getNetwork (network = 'mainnet') {
    if (network !== 'mainnet') {
      return 'https://tequila-lcd.terra.dev'
    }
    return 'https://lcd.terra.dev'
  }
}

export default TerraServices
