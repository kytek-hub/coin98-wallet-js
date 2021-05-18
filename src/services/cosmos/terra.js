class TerraServices {
  constructor ({ network }) {
    this.chain = 'terra-luna'
    this.network = this._getNetwork(network)
    // this.client = new Client(this.network)
    this.decimal = 9

    // Binding
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getNetwork = this._getNetwork.bind(this)
  }

  getBalance () {}

  transfer () {}

  // Ulities
  _getNetwork (network = 'mainnet') {
    if (network === 'mainnet') {
      return 'https://lcd.terra.dev'
    }
    return 'https://lcd.terra.dev'
  }
}

export default TerraServices
