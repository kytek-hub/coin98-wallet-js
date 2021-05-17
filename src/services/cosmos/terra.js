class TerraServices {
  constructor ({ network }) {
    this.chain = 'terra'
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

  _getNetwork () {}
}

export default TerraServices
