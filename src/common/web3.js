import { DOT_RELATIVE_CHAIN, ETHER_RELATIVE_CHAIN, SOLANA_RELATIVE_CHAIN } from '../constants'
import { CHAIN_TYPE } from '../constants/chains'
import Web3 from 'web3'
import { Connection } from '@solana/web3.js'
import { ethers } from 'ethers'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { getStorage, setStorage } from './utils'
// import { BncClient } from 'binance-chain/lib/index.js'
import 'near-api-js/dist/near-api-js'
// const bnbClient = new BncClient('https://dex.binance.org/')
// bnbClient.chooseNetwork('mainnet')
// bnbClient.initChain()
const nearAPI = require('near-api-js')
const { KeyPair, utils: nearUtils } = nearAPI

let apiPolkadot, apiKusama

export const createConnectionInstance = async (chain, isProvider, options = {}, infuraKey = null, __DEV__ = false, __ETHER__ = false, apiServices) => {
  const settings = {
    web3Link: {
      solana: 'https://solana-api.projectserum.com',
      [CHAIN_TYPE.binanceSmart]: 'https://bsc-dataseed.binance.org/',
      [CHAIN_TYPE.tomo]: `https://${!__DEV__ ? 'rpc' : 'testnet'}.tomochain.com`,
      [CHAIN_TYPE.avax]: `https://api.avax${!__DEV__ ? '' : '-test'}.network/ext/bc/C/rpc`,
      [CHAIN_TYPE.ether]: `https://${__DEV__ || __ETHER__ ? 'rinkeby' : 'mainnet'}.infura.io/v3/${infuraKey}`,
      [CHAIN_TYPE.heco]: `https://http-${__DEV__ ? 'testnet' : 'mainnet'}.hecochain.com`,
      [CHAIN_TYPE.polkadot]: 'rpc.polkadot.io',
      [CHAIN_TYPE.kusama]: 'kusama-rpc.polkadot.io',
      [CHAIN_TYPE.celo]: 'https://rc1-forno.celo-testnet.org',
      [CHAIN_TYPE.fantom]: 'https://rpcapi.fantom.network/',
      [CHAIN_TYPE.matic]: 'https://rpc-mainnet.maticvigil.com/',
      [`${CHAIN_TYPE.avax}ID`]: `0xa86${__DEV__ ? '9' : 'a'}`,
      [`${CHAIN_TYPE.tomo}ID`]: `0x${__DEV__ ? '88' : '89'}`,
      [`${CHAIN_TYPE.ether}ID`]: __DEV__ || __ETHER__ ? '0x4' : '0x1',
      [`${CHAIN_TYPE.heco}ID`]: `0x${__DEV__ ? '256' : '128'}`,
      [`${CHAIN_TYPE.binanceSmart}ID`]: '0x38',
      [`${CHAIN_TYPE.fantom}ID`]: '0xFA', // 250
      [`${CHAIN_TYPE.matic}ID`]: '0x89' // 137
    },
    gas: {
      ETH: 21000,
      TOKEN: 0,
      TOKEN_ETH: 50000
    }
  }

  // Check Infura Keys First
  if (ETHER_RELATIVE_CHAIN.indexOf(chain) >= 0) {
    // Ether relative
    const provider = settings.web3Link[chain]

    const web3 = new Web3()
    web3.setProvider(new web3.providers.HttpProvider(provider))
    return isProvider
      ? {
          web3,
          provider: new ethers.providers.Web3Provider(web3.currentProvider)
        }
      : web3
  }

  if (DOT_RELATIVE_CHAIN.indexOf(chain) >= 0) {
    if (chain === CHAIN_TYPE.polkadot && apiPolkadot) return apiPolkadot
    if (chain === CHAIN_TYPE.kusama && apiKusama) return apiKusama

    try {
      const nameKeyStore = 'KEYCHAIN' + chain
      const providerLink = 'https://' + settings.web3Link[chain]
      const wsProvider = new WsProvider('wss://' + settings.web3Link[chain])

      const fetchDataABI = async () => {
        try {
          const dataPolkadot = await getStorage(nameKeyStore)

          if (dataPolkadot && ((Date.now() - dataPolkadot.time) <= (60000 * 60 * 24))) {
            return dataPolkadot.data
          } else {
            const genesisHashQuery = JSON.stringify({ id: '1', jsonrpc: '2.0', method: 'chain_getBlockHash', params: [0] })
            const runtimeQuery = JSON.stringify({ id: '1', jsonrpc: '2.0', method: 'state_getRuntimeVersion', params: [] })
            const metadataQuery = JSON.stringify({ id: '1', jsonrpc: '2.0', method: 'state_getMetadata', params: [] })
            const config = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            }

            config.body = genesisHashQuery
            let genesisHashdata = await fetch(providerLink, config)
            config.body = runtimeQuery
            let runtimedata = await fetch(providerLink, config)
            config.body = metadataQuery
            let metadatadata = await fetch(providerLink, config)

            genesisHashdata = await genesisHashdata.json()
            runtimedata = await runtimedata.json()
            metadatadata = await metadatadata.json()

            const dataRes = { genesisHashdata, runtimedata, metadatadata }

            setStorage(nameKeyStore, { time: Date.now(), data: dataRes })

            return dataRes
          }
        } catch (error) {
          console.log(error)
        }
      }

      const dataPol = await fetchDataABI()

      const metadataKey = `${dataPol.genesisHashdata.result}-${dataPol.runtimedata.result.specVersion}`
      const metaValue = dataPol.metadatadata.result
      const metadata = {}
      metadata[metadataKey] = metaValue
      const resPolkadot = await ApiPromise.create({ provider: wsProvider, metadata })
      await resPolkadot.isReady
      if (chain === CHAIN_TYPE.kusama) {
        apiKusama = resPolkadot
        return apiKusama
      } else {
        apiPolkadot = resPolkadot
        return apiPolkadot
      }
    } catch (error) {
      console.log('Generate Polkadot Error', error)
    }
  }

  if (SOLANA_RELATIVE_CHAIN.indexOf(chain) >= 0) {
    const solConnection = new Connection(settings.web3Link.solana, 'recent')
    return solConnection
  }

  if (chain === CHAIN_TYPE.near) {
    const { connect, keyStores } = nearAPI

    const networkId = 'mainnet'
    const keyStore = new keyStores.InMemoryKeyStore()
  
    if (options) {
      const { privateKey, address: sender } = options
      const keyPair = KeyPair.fromString(privateKey)
      keyStore.setKey(networkId, sender, keyPair)
    }
  
    const config = {
      networkId,
      keyStore,
      nodeUrl: 'https://rpc.mainnet.near.org',
      walletUrl: 'https://wallet.mainnet.near.org',
      helperUrl: 'https://helper.mainnet.near.org',
      explorerUrl: 'https://explorer.mainnet.near.org'
    }
    const near = await connect(config)
  
    return near
    // const networkId = 'mainnet'
    // const keyStore = new keyStores.InMemoryKeyStore()
    // const keyPair = KeyPair.fromString(privateKey)
    // await keyStore.setKey(networkId, sender, keyPair)

    // const config = {
    //   networkId,
    //   keyStore,
    //   nodeUrl: `https://rpc.${networkId}.near.org`,
    //   walletUrl: `https://wallet.${networkId}.near.org`,
    //   helperUrl: `https://helper.${networkId}.near.org`,
    //   explorerUrl: `https://explorer.${networkId}.near.org`
    // }

    // const near = await connect(config)

    // return near
  }

  // if (chain === CHAIN_TYPE.celo) {
  //   const kitCelo = newKit(settings.web3Link[chain]).web3
  //   return kitCelo
  // }

  // if (chain === CHAIN_TYPE.binance) {
  //   return bnbClient
  // }
}
