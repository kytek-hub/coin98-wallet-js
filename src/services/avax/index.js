import Avalanche, { BN, Buffer as BufferAvalanche, utils, avm, evm } from 'avalanche'
import { Buffer } from 'buffer'
import { privateToAddress } from 'ethereumjs-util'
import HDKey from 'hdkey'
import axios from 'axios'
import BinTools from 'avalanche/dist/utils/bintools'
import { convertBalanceToWei, convertWeiToBalance } from '../../common/utils'
import { createConnectionInstance } from '../../common/web3'
import { CHAIN_TYPE } from '../../constants/chains'

const { getPreferredHRP } = utils
const { KeyPair: AVMKeyPair, KeyChain: AVMKeyChain } = avm
const { KeyChain } = evm
const bintools = BinTools.getInstance()
const AVA_ACCOUNT_PATH = 'm/44\'/9000\'/0\''

export default class AvaxX {
  constructor (props = { }) {
    const options = {
      ip: 'api.avax.network',
      port: null,
      protocol: 'https',
      network_id: 1,
      chain_id: 'X'
    }


    this.ReduxServices = props.ReduxServices
    this.mnemonic = null
    this.seed = null
    this.masterKey = null

    this.client = new Avalanche(...Object.values(options))

    this.exploreClient = axios.create({
      baseURL: 'https://explorerapi.avax.network',
      withCredentials: false,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    this.currentIndex = undefined
    this.listIndex = {}

    this.avm = this.client.XChain()
    this.cChain = this.client.CChain()
    this.web3 = createConnectionInstance(CHAIN_TYPE.avax)
    this.chainID = this.avm.getBlockchainID()

    // Bind functions
    this.importUTXOFromX = this.importUTXOFromX.bind(this)
    this.importUTXO = this.importUTXO.bind(this)
    this.getAddress = this.getAddress.bind(this)
    this.getBalance = this.getBalance.bind(this)
    this.convert = this.convert.bind(this)
    this.genMasterKey = this.genMasterKey.bind(this)
    this.getCChainAddress = this.getCChainAddress.bind(this)
    this.findFreeIndex = this.findFreeIndex.bind(this)
    this.getAddressByIndex = this.getAddressByIndex.bind(this)
    this.getAllDerivedAddresses = this.getAllDerivedAddresses.bind(this)
    this.getAddressChains = this.getAddressChains.bind(this)
    this.getKeyChain = this.getKeyChain.bind(this)
    this.getKeyForIndex = this.getKeyForIndex.bind(this)

    this.updateSeed = this.updateSeed.bind(this)
  }

  setReduxServices(reduxServices){
    this.ReduxServices = reduxServices
  }

  updateSeed(mnemonic, seed, decryptedMnemonic){
    return new Promise(async (resolve, reject) => {
      if (mnemonic && (this.mnemonic !== mnemonic)) {
        this.mnemonic = mnemonic
        this.currentIndex = undefined
        this.listIndex = {}

        if (!seed) {
          const findMasterKey = this.ReduxServices.findMasterKey(mnemonic)
          console.log("🚀 ~ file: index.js ~ line 81 ~ AvaxX ~ returnnewPromise ~ findMasterKey", findMasterKey)
          console.log("🚀 ~ file: index.js ~ line 81 ~ AvaxX ~ returnnewPromise ~ findMasterKey.xpriv || findMasterKey.privateExtendedKey", findMasterKey.xpriv || findMasterKey.privateExtendedKey)
          this.masterKey = this.genMasterKeyFromPriv(findMasterKey.xpriv || findMasterKey.privateExtendedKey)
        } else {
          this.seed = seed
          this.masterKey = this.genMasterKey(seed)
        }
      }
      resolve(this.masterKey)
    })
  }

  // Find address need seed and master key
  async getAddress(isGetFull, isGetBalance){
    let currInx = await this.findFreeIndex(this[this.mnemonic + 'index'])


    if (currInx !== this[this.mnemonic + 'index']) {
      this[this.mnemonic + 'index'] = currInx
    }

    if (isGetBalance) {
      const nowAddress = this.getAddressByIndex(currInx + 1)
      
      this.ReduxServices.updateXWallet(this.mnemonic, nowAddress)
    } else {
      currInx += 1
    }

    const currentAddress = this.getAddressByIndex(currInx)
    if (!isGetBalance) {
      this.ReduxServices.updateXWallet(this.mnemonic, currentAddress)
    }

    if (isGetFull) {
      const allAddress = this.getAllDerivedAddresses(currInx, 0)
      return { address: allAddress, currentAddress }
    } else {
      return { address: currentAddress, index: currInx - 1 }
    }
  }

  async getBalance(){
    const address = await this.getAddress(true)

    console.log('Balance address', address)

    const updatedU = await this.avm.getUTXOs(address)
    const updatedUTXOs = updatedU.utxos.getAllUTXOs()
    const outputArr = updatedUTXOs.map(it => it.output.amountValue.toNumber())
    const balance = outputArr.reduce((total = 0, current) => parseFloat(total) + parseFloat(current), 0)
    return convertWeiToBalance(balance, 9)
  }

  async transfer  (mnemonic, to, amount) {
    const fAmount = new BN(convertBalanceToWei(amount, 9))
    const { address, currentAddress } = await this.getAddress(true)
    const updatedU = await this.avm.getUTXOs(address)
    const utxos = updatedU.utxos
    const assetID = await this.avm.getAVAXAssetID()

    const unsignedTx = await this.avm.buildBaseTx(utxos, fAmount, assetID, [to], address, [currentAddress])
    const allKey = await this.getKeyChain(mnemonic)

    const signedTx = unsignedTx.sign(allKey)
    const txid = await this.avm.issueTx(signedTx)

    return txid
  }

  async convert (amount, isFromX, baseMnemonic, pairMnemonic,callbackDone) {
    try {
      const amountConvert = new BN(convertBalanceToWei(amount, 9))

      let hash

      const fee = this.avm.getTxFee()
      const amtFee = amountConvert.add(fee)

      const checkStatus = async (txsId, callback, from, nonce, tries = 0) => {
        let status
        if (isFromX) {
          status = await this.avm.getTxStatus(txsId)
        } else {
          const nonceNow = await this.web3.eth.getTransactionCount(from)
          if (nonceNow === nonce) {
            status = 'Processing'
          } else {
            status = 'Accepted'
          }
        }
        const res = false
        if (status === 'Unknown' || status === 'Processing' || res) {
          return await checkStatus(txsId, callback, from, nonce, tries + 1)
        } else {
          // if (isFromX) {
          //   callback()
          // } else {
          //   callback()
          // }
          callback()
          return true
        }
      }

      if (isFromX) {
        const { addrBech, addrHex, keyChain } = await this.getCChainAddress(pairMnemonic)

        const { address, currentAddress } = await this.getAddress(true)
        const fromAddresses = address
        const changeAddress = currentAddress
        const destinationChainId = this.cChain.getBlockchainID()
        const utxos = await this.avm.getUTXOs(address)
        const utxosSet = utxos.utxos

        const exportTx = await this.avm.buildExportTx(utxosSet, amtFee, destinationChainId, [addrBech], fromAddresses, [changeAddress])
        const allKey = await this.getKeyChain()
        const tx = exportTx.sign(allKey)
        hash = await this.avm.issueTx(tx)

        await checkStatus(hash, async () => {
          this.importUTXO(addrBech, addrHex, keyChain, callbackDone)
          // const bechAddr = addrBech
          // const hexAddr = addrHex
          // const utxoResponse = await this.cChain.getUTXOs(bechAddr, this.avm.getBlockchainID())
          // const utxoSet = utxoResponse.utxos

          // const toAddress = '0x' + hexAddr
          // const ownerAddresses = [bechAddr]
          // const fromAddresses = ownerAddresses
          // const sourceChain = this.avm.getBlockchainID()
          // const unsignedTx = await this.cChain.buildImportTx(
          //   utxoSet,
          //   toAddress,
          //   ownerAddresses,
          //   sourceChain,
          //   fromAddresses
          // )
          // const tx = await unsignedTx.sign(keyChain)
          // await this.cChain.issueTx(tx)
        })
      } else {
        const { addrBech, addrHex, keyChain } = await this.getCChainAddress(baseMnemonic)

        const hexAddr = addrHex
        const bechAddr = addrBech

        const responseAddr = await this.getAddress()
        const destinationAddr = responseAddr.address
        const destinationChainId = this.avm.getBlockchainID()

        const nonce = await this.web3.eth.getTransactionCount(hexAddr)
        const avaxAssetIDBuf = await this.avm.getAVAXAssetID()
        const avaxAssetIDStr = bintools.cb58Encode(avaxAssetIDBuf)
        const fromAddressHex = hexAddr

        const exportTx = await this.cChain.buildExportTx(
          amtFee,
          avaxAssetIDStr,
          destinationChainId,
          fromAddressHex,
          bechAddr,
          [destinationAddr],
          nonce
        )

        const tx = await exportTx.sign(keyChain)
        hash = await this.cChain.issueTx(tx)

        await checkStatus(hash, async () => {
          this.importUTXOFromX(pairMnemonic, callbackDone)
        }, hexAddr, nonce)
      }

      console.log('Hash convert ', isFromX ? 'X to C' : 'C to X', hash)

      return hash
    } catch (error) {
      console.log('Hash convert error', isFromX ? 'X to C' : 'C to X', error)
      return null
    }
  }

  // Private Method

  async importUTXO (addrBech, addrHex, keyChain, callbackDone) {
    const bechAddr = addrBech
    const hexAddr = addrHex
    const utxoResponse = await this.cChain.getUTXOs(bechAddr, this.avm.getBlockchainID())
    const utxoSet = utxoResponse.utxos
    const toAddress = '0x' + hexAddr
    const ownerAddresses = [bechAddr]
    const fromAddresses = ownerAddresses
    const sourceChain = this.avm.getBlockchainID()
    const unsignedTx = await this.cChain.buildImportTx(
      utxoSet,
      toAddress,
      ownerAddresses,
      sourceChain,
      fromAddresses
    )
    const tx = await unsignedTx.sign(keyChain)
    const hashOutput = await this.cChain.issueTx(tx)
    console.log('hashOutput', hashOutput)
    callbackDone && callbackDone()
  }

  async importUTXOFromX (pairMnemonic, callbackDone){
    await this.updateSeed(pairMnemonic)
    const { address, currentAddress } = await this.getAddress(true)
    const utxoSet = await this.avmGetAtomicUTXOs(address)
    const lengthUTXO = getLength(utxoSet.getAllUTXOs())
    if (lengthUTXO > 0) {
      const xToAddr = currentAddress
      const hrp = this.client.getHRP()
      const utxoAddrs = utxoSet
        .getAddresses()
        .map((addr) => bintools.addressToString(hrp, 'X', addr))
      const fromAddrs = utxoAddrs
      const ownerAddrs = utxoAddrs
      const sourceChainId = this.cChain.getBlockchainID()
      const unsignedTx = await this.avm.buildImportTx(
        utxoSet,
        ownerAddrs,
        sourceChainId,
        [xToAddr],
        fromAddrs,
        [xToAddr]
      )
      const keyChain = await this.getKeyChain()
      const tx = await unsignedTx.sign(keyChain)
      const txId = this.avm.issueTx(tx)
      callbackDone && callbackDone()
      return txId
    }
  }


  async avmGetAtomicUTXOs   (addrs) {
    const resultC = (await this.avm.getUTXOs(addrs, this.cChain.getBlockchainID())).utxos
    return resultC
  }

  async getCChainAddress  (mnemonic) {
    const bip39 = require('bip39')
    const seed = await bip39.mnemonicToSeed(mnemonic)
    const masterKey = HDKey.fromMasterSeed(seed)

    const accountKey = masterKey.derive('m/44\'/9000\'/0\'/0/0')
    const ethPrivateKey = accountKey.privateKey
    const ethAddress = privateToAddress(ethPrivateKey).toString('hex')

    const cPrivKey = 'PrivateKey-' + bintools.cb58Encode(BufferAvalanche.from(ethPrivateKey))
    const cKeyChain = new KeyChain(this.client.getHRP(), 'C')
    const cKeypair = cKeyChain.importKey(cPrivKey)
    const res = cKeypair.getAddressString()

    return { addrHex: ethAddress, addrBech: res, keyChain: cKeyChain }
  }

  genMasterKey (seed){
    const masterHdKey = HDKey.fromMasterSeed(seed)
    const accountHdKey = masterHdKey.derive(AVA_ACCOUNT_PATH)

    return accountHdKey
  }

  genMasterKeyFromPriv (seed) {
    const masterHdKey = HDKey.fromExtendedKey(seed)
    return masterHdKey
  }

  async getKeyChain   () {
    const curridx = await this.findFreeIndex(this[this.mnemonic + 'index'])

    const hrp = getPreferredHRP(this.client.getNetworkID())
    const keychain = new AVMKeyChain(hrp, 'X')

    for (let i = 0; i <= curridx; i++) {
      const internalKey = this.getKeyForIndex(i, true)
      const externalKey = this.getKeyForIndex(i)
      keychain.importKey(internalKey)
      keychain.importKey(externalKey)
    }
    return keychain
  }

  getKeyForIndex (index, isInternal){
    const derivationPath = `${isInternal ? 'm/1' : 'm/0'}/${index.toString()}`
    const key = this.masterKey.derive(derivationPath)
    const pkHEx = key.privateKey.toString('hex')
    const pkBuf = new Buffer(pkHEx, 'hex')
    return pkBuf
  }

  // For find address and index address
  getAddressByIndex (index, isInternal) {
    try {
      const idxFormat = index.toString()

      if (this.listIndex[idxFormat]) {
        return this.listIndex[idxFormat]
      }

      const derivationPath = `${isInternal ? 'm/1' : 'm/0'}/${idxFormat}`
      const key = this.masterKey.derive(derivationPath)
      const pkHex = key.publicKey.toString('hex')
      const pkBuff = Buffer.from(pkHex, 'hex')
      const netID = 1
      const hrp = getPreferredHRP(netID)
      const chainId = 'X'
      const keypair = new AVMKeyPair(hrp, chainId)
      const addrBuf = keypair.addressFromPublicKey(pkBuff)
      const addr = bintools.addressToString(hrp, chainId, addrBuf)

      this.listIndex[idxFormat] = addr

      return addr
    } catch (error) {
      console.log('error', error)
    }
  }

  getAllDerivedAddresses (upTo, start) {
    const res = []
    const resInternal = []
    for (let i = start; i <= upTo; i++) {
      const addr = this.getAddressByIndex(i)
      const addrInternal = this.getAddressByIndex(i, true)
      res.push(addr)
      resInternal.push(addrInternal)
    }
    return res.concat(resInternal)
  }

  async getAddressChains (addrs) {
    const rawAddrs = addrs.map((addr) => {
      return addr.split('-')[1]
    })
    const urlRoot = '/v2/addressChains'
    const res = await this.exploreClient.post(urlRoot, {
      address: rawAddrs,
      disableCount: ['1']
    })
    if (res && res.data) {
      // If not find any address on chain match to null
      return Object.keys(res.data.addressChains).length > 0 ? res.data.addressChains : null
    }
    return null
  }

  async findFreeIndex(startIndex = 0) {
    const upTo = 1
    const addrs = this.getAddressByIndex(startIndex + upTo)
    console.log(startIndex, addrs)

    const addrChains = await this.getAddressChains([addrs])

    if (!addrChains) {
      return startIndex
    } else {
      return await this.findFreeIndex(startIndex + upTo)
    }
  }
}
