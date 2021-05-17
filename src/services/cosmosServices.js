import Services from './cosmos'

class CosmosServices {
  constructor ({ chain }) {
    this.client = new Services[chain]()

    // Bind
    this.getBalance = this.getBalance.bind(this)
  }

  getBalance () {
    return this.client.getBalance(...arguments)
  }

  transfer () {
    return this.client.transfer(...arguments)
  }
}

export default CosmosServices
