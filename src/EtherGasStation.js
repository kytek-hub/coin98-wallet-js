import { CHAIN_TYPE } from '../constants/chain_supports'

class EtherGasStation {
  constructor ({ apiServices }) {
    this.apiServices = apiServices

    this.getGasStationFull = this.getGasStationFull.bind(this)
    this.getGasStation = this.getGasStation.bind(this)
    return this
  }

  static getGasPrice () {
    const possible = [10000000000]
    const results = possible.sort(function () {
      return 0.5 - Math.random()
    })
    return results[0]
  }

  static async getGasStationFull (chain) {
    if (chain === CHAIN_TYPE.binanceSmart) {
      const standard = 20
      return {
        standard: parseFloat((standard * 1.1).toFixed(0)),
        fast: parseFloat((standard * 1.3).toFixed(0)),
        fastest: parseFloat((standard * 1.7).toFixed(0)),
        gaswar: parseFloat((standard * 3).toFixed(0)),
        starwar: parseFloat((standard * 5).toFixed(0))
      }
    }
    const response =
      chain === CHAIN_TYPE.tomo
        ? {
            lowest: 6,
            fastest: 20,
            fast: 15,
            standard: 10,
            low: 8,
            gaswar: 32,
            starwar: 40
          }
        : await this.apiServices.getData('cryptoData/ethGas', { chain })
    return response
  }

  static async getGasStation (chain) {
    const response =
      chain === CHAIN_TYPE.tomo
        ? { standard: 10 }
        : await this.apiServices.getData('cryptoData/ethGas', { chain })

    return response
      ? response.standard * Math.pow(10, 9)
      : 10 * Math.pow(10, 9)
  }
}

export default EtherGasStation
