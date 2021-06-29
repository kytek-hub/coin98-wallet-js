import { ethers } from 'ethers'
import { PublicKey, Account, Transaction, SystemProgram, TransactionInstruction, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { Keyring } from '@polkadot/keyring/index.js'
import nacl from 'tweetnacl'
import { lowerCase } from 'lodash'
import * as BufferLayout from 'buffer-layout'
import converter from 'hex2dec'
import { publicKeyLayout } from '@project-serum/serum/lib/layout'
// Local Import
import EtherGasStation from './EtherGasStation'
import { COSMOS_RELATIVE_CHAIN, MEMO_PROGRAM_ID, MIN_ABI, SUPPORTED_CHAIN, TOKEN_PROGRAM_ID } from './constants'
import { ACCOUNT_LAYOUT, convertBalanceToWei, convertWeiToBalance, generateDataToken, getLength, sleep, renderFormatWallet } from './common/utils'
import { CHAIN_TYPE } from './constants/chains'
import { createConnectionInstance } from './common/web3'
import TronWeb from 'tronweb'
import crypto from 'webcrypto'
import Ripemd160 from 'ripemd160'
import { bech32 } from 'bech32'
import { derivePath as SolDerivePath } from 'ed25519-hd-key'
import AvaxX from './services/avax'
// import 'near-api-js/dist/near-api-js'
import CosmosServices from './services/cosmosServices'
const { derivePath } = require('near-hd-key')
const bip39 = require('bip39')
const bs58 = require('bs58')
const bip32 = require('bip32')
// const { KeyPair, utils } = window.nearApi
const nearAPI = require('near-api-js')
const { KeyPair, utils: nearUtils } = nearAPI

//* New Wallet with object = { mnemonic, privateKey }
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  solidityNode: 'https://api.trongrid.io',
  eventServer: 'https://api.trongrid.io',
  privateKey: 'd1299bf83d9819560b90957253b6e481faf54f88374f0525b660dfa63a2b4b5c'
})

export const OWNER_VALIDATION_PROGRAM_ID = new PublicKey(
  '4MNPdKu9wFMvEeZBMt3Eipfs5ovVWTJb31pEXDJAAxX5'
)

const _parseTokenAccountData = (data) => {
  const { mint, owner, amount } = ACCOUNT_LAYOUT.decode(data)
  return {
    mint: new PublicKey(mint),
    owner: new PublicKey(owner),
    amount
  }
}

export const OWNER_VALIDATION_LAYOUT = BufferLayout.struct([
  publicKeyLayout('account')
])

export function encodeOwnerValidationInstruction (instruction) {
  const b = Buffer.alloc(OWNER_VALIDATION_LAYOUT.span)
  const span = OWNER_VALIDATION_LAYOUT.encode(instruction, b)
  return b.slice(0, span)
}

export const avaxClient = new AvaxX()

const assertOwner = ({ account, owner }) => {
  const keys = [{ pubkey: account, isSigner: false, isWritable: false }]
  return new TransactionInstruction({
    keys,
    data: encodeOwnerValidationInstruction({ account: owner }),
    programId: OWNER_VALIDATION_PROGRAM_ID
  })
}

const memoInstruction = (memo) => {
  return new TransactionInstruction({
    keys: [],
    data: Buffer.from(memo, 'utf-8'),
    programId: MEMO_PROGRAM_ID
  })
}

const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'))
LAYOUT.addVariant(
  0,
  BufferLayout.struct([
    BufferLayout.u8('decimals'),
    BufferLayout.blob(32, 'mintAuthority'),
    BufferLayout.u8('freezeAuthorityOption'),
    BufferLayout.blob(32, 'freezeAuthority')
  ]),
  'initializeMint'
)
LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount')
LAYOUT.addVariant(
  3,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'transfer'
)
LAYOUT.addVariant(
  7,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'mintTo'
)
LAYOUT.addVariant(
  8,
  BufferLayout.struct([BufferLayout.nu64('amount')]),
  'burn'
)

class Wallet {
  constructor (defaults = {
    mnemonic: null,
    privateKey: null,
    isDev: false,
    isDevEther: false,
    apiServices: null,
    infuraKey: null,
    infuraKeys: []
  }) {
    // Local Properties
    this.mnemonic = defaults.mnemonic
    this.privateKey = defaults.privateKey
    this.seed = null
    this.__DEV__ = defaults.isDev || false
    this.__ETHER__ = defaults.isDevEther || false
    this.apiServices = defaults.apiServices || null
    this.infuraKey = defaults.infuraKey || '8bc501492617482da2029e9b84465030'
    this.web3 = null
    this.solanaConnection = null
    this.avaxClient = avaxClient
    // Bind Function
    this.setMnemonic = this.setMnemonic.bind(this)
    this.setPrivateKey = this.setPrivateKey.bind(this)
    this.create = this.create.bind(this)
    this.getBalance = this.getBalance.bind(this)
    this.getTokenBalance = this.getTokenBalance.bind(this)
    this.send = this.send.bind(this)
    this.setReduxServices = this.setReduxServices.bind(this)
    // Private method binding
    this._createEthWallet = this._createEthWallet.bind(this)
    this._createDotWallet = this._createDotWallet.bind(this)
    this._createSolWallet = this._createSolWallet.bind(this)
    this._createDotWallet = this._createDotWallet.bind(this)
    this._createTronWallet = this._createTronWallet.bind(this)
    this._createNearWallet = this._createNearWallet.bind(this)
    this._createBinanceWallet = this._createBinanceWallet.bind(this)
    this._getBalanceEthWallet = this._getBalanceEthWallet.bind(this)
    this._getBalanceDotWallet = this._getBalanceDotWallet.bind(this)
    this._getBalanceSolWallet = this._getBalanceSolWallet.bind(this)
    this._getBalanceNearWallet = this._getBalanceNearWallet.bind(this)
    this._getBalanceTronWallet = this._getBalanceTronWallet.bind(this)
    this._getTokenBalanceSolWallet = this._getTokenBalanceSolWallet.bind(this)
    this._getTokenBalanceEthWallet = this._getTokenBalanceEthWallet.bind(this)
    this._sendFromEthWallet = this._sendFromEthWallet.bind(this)
    this._sendFromSolWallet = this._sendFromSolWallet.bind(this)
    this._sendFromDotWallet = this._sendFromDotWallet.bind(this)
    this._sendFromNearWallet = this._sendFromNearWallet.bind(this)
    this._sendFromTronWallet = this._sendFromTronWallet.bind(this)
    this._sendFromBinanceWallet = this._sendFromBinanceWallet.bind(this)
    // Utils binding
    this._transfer = this._transfer.bind(this)
    this._createTransferBetweenSplTokenAccountsInstruction = this._createTransferBetweenSplTokenAccountsInstruction.bind(this)
    this._encodeTokenInstructionData = this._encodeTokenInstructionData.bind(this)
    this._awaitTransactionSignatureConfirmation = this._awaitTransactionSignatureConfirmation.bind(this)
    this._genNearKey = this._genNearKey.bind(this)
    this._postBaseSendTxs = this._postBaseSendTxs.bind(this)
  }

  // * ---------
  // * Getter
  // * ---------
  getMnemonic () {
    return this.mnemonic
  }

  getPrivateKey () {
    return this.privateKey
  }

  getSupportChains () {
    return SUPPORTED_CHAIN
  }

  setReduxServices(reduxServices){
    avaxClient.setReduxServices(reduxServices)
  }

  // * ---------
  // * Setter
  // * ---------

  setMnemonic (mnemonic) {
    this.mnemonic = mnemonic
  }

  setPrivateKey (privateKey) {
    this.privateKey = privateKey
  }

  /** Important method */
  async create (chain, options = {}, callback = null) {
    if (typeof chain !== 'string' && typeof chain !== 'object') {
      throw new Error('Please provide correct format of chain type')
    }

    let processChain = typeof chain === 'string' ? [chain] : chain

    if (chain === CHAIN_TYPE.multiChain) {
      // Re-assign MultiChain
      processChain = SUPPORTED_CHAIN
    }

    if (!this._checkExists(processChain)) {
      throw new Error('Please check your input chain again, some of them not exists in our context')
    }

    const asyncCreate = processChain.map(async (createChain) => {
      const createFunction = this._chainActionFunction(createChain, 'create')
      if (typeof createFunction === 'function') { return createFunction(createChain, options) }

      return null
    })

    try {
      const createdWallet = await Promise.all(asyncCreate)

      const wallets = [...createdWallet].map(it => renderFormatWallet({ ...it, ...options }))
      // To object
      // Return value with callback
      if (typeof callback === 'function') {
        callback(wallets)
      }
      // Return for async call
      return wallets
    } catch (e) {
      throw new Error(e.toString())
    }
  }

  async getBalance (address, chain, callback) {
    if (!address) {
      throw new Error('Please enter correct address')
    }

    if (!chain || !this._checkExists(chain)) {
      throw new Error(`Please enter one of the following supported chain: ${JSON.stringify(SUPPORTED_CHAIN)}`)
    }

    const getBalanceFunction = this._chainActionFunction(chain, 'getBalance')
    try {
      const balance = await getBalanceFunction(address, chain)
      // Return value with callback
      if (typeof callback === 'function') {
        callback(balance)
      }
      // Return for async call
      return balance
    } catch (e) {
      throw new Error(e)
    }
  }

  async getTokenBalance (contractAddress, address, decimalToken, chain, solTokenAddress, callback) {
    const getTokenBalanceFunction = this._chainActionFunction(chain, 'getTokenBalance')

    try {
      const balance = await getTokenBalanceFunction({ contractAddress, address, decimalToken, chain, solTokenAddress })
      // Return value with callback
      if (typeof callback === 'function') {
        callback(balance)
      }
      // Return for async call
      return balance
    } catch (e) {
      throw new Error(e)
    }
  }

  async send ({ toAddress, amount, sendContract, gas, chain, callback, data, gasLimit, nonce, memo = '', isSollet, advanceInfo }) {
    const sendFunction = this._chainActionFunction(chain, 'sendFrom')
    try {
      const hash = await sendFunction({ toAddress, amount, sendContract, gas, chain, callback, data, gasLimit, nonce, memo, isSollet, advanceInfo })
      if (typeof callback === 'function') {
        callback(hash)
      }

      return hash
    } catch (e) {
      console.log('e', e)
      throw new Error(e)
    }
  }

  async sendToken () { }

  // * Private method */
  // Ether Chain || Relative Ether Chain
  async _createEthWallet (chain, options) {
    const { privateKey } = this

    let derivePath = "m/44'/60'/0'/0/0"

    if (chain === CHAIN_TYPE.tomo) {
      derivePath = 'm/44\'/889\'/0\'/0/0'
    }

    if (chain === CHAIN_TYPE.avax) {
      derivePath = 'm/44\'/9000\'/0\'/0/0'
    }

    if (chain === CHAIN_TYPE.celo) {
      derivePath = 'm/44\'/52752\'/0\'/0/0'
    }

    if (chain === CHAIN_TYPE.avaxX) {
      const seed = await this._genSeed()
      console.log(this.seed)
      const masterKey = await avaxClient.updateSeed(this.mnemonic, seed)
      const currentAddress = await avaxClient.getAddress()
      const resObj = { masterKey, address: currentAddress.address, mnemonic: this.mnemonic, chain }
      return resObj;
    }

    let ethWallet
    if (privateKey) {
      const node = new ethers.Wallet(privateKey)

      ethWallet = node.signingKey ? { ...node.signingKey } : node
    } else {
      const seed = await this._genSeed()
      ethWallet = ethers.utils.HDNode.fromSeed(seed).derivePath(
        options.derivePath || derivePath
      )
    }

    this.privateKey = ethWallet.privateKey

    if (ethWallet.mnemonic) {
      this.mnemonic = ethWallet.mnemonic
    }

    return { ...ethWallet, mnemonic: this.mnemonic, chain }
  }

  async _getBalanceEthWallet (address, chain) {
    // Generate Web3
    if (!this[chain]) {
      this[chain] = await createConnectionInstance(
        chain,
        false,
        null,
        this.infuraKey,
        this.__DEV__,
        this.__ETHER__,
        this.apiServices
      )
    }

    try {
      const balance = await this[chain].eth.getBalance(address)
      return convertWeiToBalance(balance)
    } catch (e) {
      throw new Error(e)
    }
  }

  async _getTokenBalanceEthWallet ({ contractAddress, address, decimalToken, chain }) {
    // Generate Web3
    if (!this[chain]) {
      this[chain] = await createConnectionInstance(
        chain,
        false,
        null,
        this.infuraKey,
        this.__DEV__,
        this.__ETHER__,
        this.apiServices

      )
    }

    const contract = new this[chain].eth.Contract(MIN_ABI, contractAddress)

    return new Promise((resolve) => {
      contract.methods.balanceOf(address).call().then(balance => {
        if (decimalToken) {
          const tokenBalance = convertWeiToBalance(balance, decimalToken)
          resolve(tokenBalance)
        } else {
          contract.methods.decimals().call().then(decimal => {
            const tokenBalance = convertWeiToBalance(balance, decimal)
            resolve(tokenBalance)
          }).catch(() => {
            const tokenBalance = convertWeiToBalance(balance, 18)
            resolve(tokenBalance)
          })
        }
      }).catch((e) => {
        resolve(0)
      })
    })
  }

  async _sendFromEthWallet ({ toAddress, amount, sendContract, gas, gasLimit, chain, data, nonce, advanceInfo }) {
    if (!this[chain]) {
      this[chain] = await createConnectionInstance(
        chain,
        false,
        null,
        this.infuraKey,
        this.__DEV__,
        this.__ETHER__,
        this.apiServices
      )
    }

    try {
      let contract = sendContract
      let isETHContract = false
      let dataForSend = ''
      if (!contract && toAddress) {
        const isETH = await this[chain].eth.getCode(toAddress) === '0x'
        isETHContract = true
        if (!isETH) {
          contract = {
            address: toAddress,
            decimal: await this.getTokenDecimal(toAddress)
          }
        }
      }
      if (contract) {
        const amountConvert = convertBalanceToWei(amount, contract.decimal)
        dataForSend = data || generateDataToken(amountConvert, toAddress)
      }

      const generateTxs = {
        to: contract ? contract.address : toAddress,
        data: dataForSend
      }

      if (!sendContract && isETHContract) {
        generateTxs.value = amount
      }
      if (gasLimit) {
        generateTxs.gasLimit = gasLimit
      }

      if (gas) {
        generateTxs.gasPrice = convertBalanceToWei(gas, 9)
        if (chain === CHAIN_TYPE.celo) {
          generateTxs.celoTxs = {
            to: toAddress,
            isToken: !!contract,
            amount: convertBalanceToWei(amount, contract ? contract.decimal : 18)
          }
        }
      }

      if (advanceInfo) {
        generateTxs.gasPrice = convertBalanceToWei(advanceInfo.gasPrice, 9)
        generateTxs.nounce = parseFloat(advanceInfo.nounce)
        generateTxs.data = (contract && contract.data === '0x') ? generateTxs.data : advanceInfo.data
        generateTxs.gasLimit = advanceInfo.gasLimit
      }


      if (data) {
        generateTxs.data = data
      }
      if (nonce) {
        generateTxs.nounce = nonce
      }
      const result = await this._postBaseSendTxs([generateTxs], false, chain)
      return result[0]
    } catch (error) {
      throw new Error(error)
    }
  }

  // Solana
  async _createSolWallet (chain, options) {
    const { isSollet, derivePath } = options
    const seed = await this._genSeed()
    const deriveSeed = derivePath || SolDerivePath('m/44\'/501\'/0\'/0\'', seed).key
    const keyPair = nacl.sign.keyPair.fromSeed(isSollet ? deriveSeed : seed.slice(0, 32))
    const node = new Account(keyPair.secretKey)
    return {
      privateKey: node.secretKey.toString(),
      address: node.publicKey.toString(),
      chain,
      mnemonic: this.mnemonic,
      isSollet
    }
  }

  async _getBalanceSolWallet (address) {
    if (!this.solanaConnection) {
      this.solanaConnection = await createConnectionInstance(CHAIN_TYPE.solana)
    }

    try {
      const balance = await this.solanaConnection.getBalance(new PublicKey(address))
      return convertWeiToBalance(balance, 9)
    } catch (e) {
      throw new Error(e)
    }
  }

  async _getTokenBalanceSolWallet ({ contractAddress, decimalToken, address, solTokenAddress }) {
    if (!this.solanaConnection) {
      this.solanaConnection = await createConnectionInstance(CHAIN_TYPE.solana)
    }

    const token = { address: contractAddress, decimal: decimalToken }
    const mintPublicKey = new PublicKey(token.address.toString())
    const accountToken = await this.solanaConnection.getTokenAccountsByOwner(new PublicKey(address), { mint: mintPublicKey })

    if (getLength(accountToken.value) > 0) {
      const findAccount = !solTokenAddress ? accountToken.value[0] : accountToken.value.find(item => lowerCase(item.pubkey.toString()) === lowerCase(solTokenAddress))
      if (findAccount) {
        const { amount } = _parseTokenAccountData(findAccount.account.data)
        const amountToken = convertWeiToBalance(amount, token.decimal)
        return amountToken
      } else {
        return 0
      }
    } else {
      return 0
    }
  }

  _createTransferBetweenSplTokenAccountsInstruction ({
    ownerPublicKey,
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo
  }) {
    const transaction = new Transaction().add(
      this._transfer({
        source: sourcePublicKey,
        destination: destinationPublicKey,
        owner: ownerPublicKey,
        amount
      })
    )
    if (memo) {
      transaction.add(memoInstruction(memo))
    }
    return transaction
  }

  static async checkTokenSolanaExist (token, address, solTokenAddress) {
    const connectionSolana = await createConnectionInstance(CHAIN_TYPE.solana)

    const mintPublicKey = new PublicKey(token.address.toString())
    const accountToken = await connectionSolana.getTokenAccountsByOwner(new PublicKey(address), { mint: mintPublicKey })
    if (getLength(accountToken.value) > 0) {
      const findAccount = !solTokenAddress
        ? accountToken.value[0]
        : accountToken.value.find(item => lowerCase(item.pubkey.toString()) === lowerCase(solTokenAddress))
      if (findAccount) {
        const { amount } = _parseTokenAccountData(findAccount.account.data)
        const amountToken = convertWeiToBalance(amount, token.decimal)
        return { address: findAccount.pubkey.toString(), amount: amountToken }
      } else {
        return null
      }
    } else {
      return null
    }
  }

  async _sendFromSolWallet ({ toAddress, amount, sendContract, isSollet }) {
    if (!this.solanaConnection) {
      this.solanaConnection = await createConnectionInstance(CHAIN_TYPE.solana)
    }

    if (!this.mnemonic) {
      throw new Error('Please Provide Your Mnemonic First')
    }

    const sendTokenSolanaTxs = async (sendContract, toAddress, account, amount, connectionSolana) => {
      try {
        const transaction = new Transaction().add(
          this._transfer({
            source: new PublicKey(sendContract.baseAddress),
            destination: new PublicKey(toAddress),
            owner: account.publicKey,
            amount: convertBalanceToWei(amount, sendContract.decimal)
          })
        )

        const hash = await connectionSolana.sendTransaction(transaction, [account], { preflightCommitment: 'single' })
        try {
          await this._awaitTransactionSignatureConfirmation(hash)
          return hash
        } catch (error) {
          throw new Error(error)
        }
      } catch (error) {
        throw new Error(error)
      }
    }

    const seed = await bip39.mnemonicToSeed(this.mnemonic)
    const deriveSeed = SolDerivePath('m/44\'/501\'/0\'/0\'', seed).key
    const keyPair = nacl.sign.keyPair.fromSeed(isSollet ? deriveSeed : seed.slice(0, 32))
    const account = new Account(keyPair.secretKey)

    // Send token solana
    if (sendContract) {
      const destinationAccountInfo = await this.solanaConnection.getAccountInfo(
        new PublicKey(toAddress)
      )

      if (
        !!destinationAccountInfo &&
        destinationAccountInfo.owner.equals(TOKEN_PROGRAM_ID)
      ) {
        const hash = await sendTokenSolanaTxs(sendContract, toAddress, account, amount, this.solanaConnection)
        return hash
      }
      // if (!destinationAccountInfo || destinationAccountInfo.lamports === 0) {
      //   return reject(noSolReceiver)
      // }

      const accountInfo = await Wallet.checkTokenSolanaExist(sendContract, toAddress)

      if (accountInfo) {
        const hash = await sendTokenSolanaTxs(sendContract, accountInfo.address, account, amount, this.solanaConnection)
        return hash
      }
      // Send and create new Token account solana
      const newAccount = new Account()
      const transaction = new Transaction()
      transaction.add(
        assertOwner({
          account: new PublicKey(toAddress),
          owner: SystemProgram.programId
        })
      )
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: account.publicKey,
          newAccountPubkey: newAccount.publicKey,
          lamports: await this.solanaConnection.getMinimumBalanceForRentExemption(
            ACCOUNT_LAYOUT.span
          ),
          space: ACCOUNT_LAYOUT.span,
          programId: TOKEN_PROGRAM_ID
        })
      )
      const initializeAccount = ({ account, mint, owner }) => {
        const keys = [
          { pubkey: account, isSigner: false, isWritable: true },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: owner, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
        ]
        return new TransactionInstruction({
          keys,
          data: this._encodeTokenInstructionData({
            initializeAccount: {}
          }),
          programId: TOKEN_PROGRAM_ID
        })
      }

      transaction.add(
        initializeAccount({
          account: newAccount.publicKey,
          mint: new PublicKey(sendContract.address),
          owner: new PublicKey(toAddress)
        })
      )
      const transferBetweenAccountsTxn = this._createTransferBetweenSplTokenAccountsInstruction(
        {
          ownerPublicKey: account.publicKey,
          sourcePublicKey: new PublicKey(sendContract.baseAddress),
          destinationPublicKey: newAccount.publicKey,
          amount: convertBalanceToWei(amount, sendContract.decimal)
        }
      )

      console.log({
        account: newAccount.publicKey.toString(),
        mint: new PublicKey(sendContract.address).toString(),
        owner: new PublicKey(toAddress).toString()
      })

      console.log({
        ownerPublicKey: account.publicKey,
        sourcePublicKey: new PublicKey(sendContract.baseAddress).toString(),
        destinationPublicKey: newAccount.publicKey.toString(),
        amount: convertBalanceToWei(amount, sendContract.decimal)
      })

      transaction.add(transferBetweenAccountsTxn)
      const signers = [account, newAccount]

      try {
        const hash = await this.solanaConnection.sendTransaction(transaction, signers, { preflightCommitment: 'single' })
        try {
          await this._awaitTransactionSignatureConfirmation(hash)
          return hash
        } catch (error) {
          throw new Error(error)
        }
      } catch (error) {
        throw new Error(error)
      }
    } else {
      let transaction
      try {
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: account.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports: convertBalanceToWei(amount, 9)
          })
        )
      } catch (error) {
        throw new Error(error)
      }

      try {
        const hash = await this.solanaConnection.sendTransaction(transaction, [account], { preflightCommitment: 'single' })
        try {
          await this._awaitTransactionSignatureConfirmation(hash)
          return hash
        } catch (e) {
          throw new Error('timeOutTxs')
        }
      } catch (e) {
        throw new Error(e)
      }
    }
  }

  // Polkadot || Kusama
  async _createDotWallet (chain) {
    const otherMnemonic = await this._genSeed(true)
    const isKusama = chain === CHAIN_TYPE.kusama
    const ss58Format = isKusama ? 2 : 0

    const keyringPolkadot = new Keyring({ type: 'sr25519', ss58Format })
    const nodePolkadot = keyringPolkadot.addFromUri(otherMnemonic)
    return { privateKey: '', address: nodePolkadot.address, mnemonic: otherMnemonic, chain }
  }

  async _getBalanceDotWallet (address, chain) {
    if (!this.apiServices) throw new Error('Please provide [apiServices]')

    try {
      const balancePol = await this.apiServices.postData('web3/polkadot', { chain, address })
      return balancePol || 0
    } catch (e) {
      return 0
    }
  }

  async _getTokenBalanceDotWallet () {
    // Dot token not implemented
  }

  async _sendFromDotWallet ({ toAddress, amount, chain }) {
    if (!this.mnemonic) {
      throw new Error('Please provide your mnemonic first')
    }

    try {
      const isKSM = chain === CHAIN_TYPE.kusama
      const keyring = new Keyring({ type: 'sr25519', ss58Format: isKSM ? 2 : 0 })
      const pairPolkadot = keyring.addFromUri(this.mnemonic)
      const polkadotApi = await createConnectionInstance(chain)

      if (!isKSM) {
        const { data: balance } = await polkadotApi.query.system.account(toAddress)
        const toBalance = parseFloat(convertWeiToBalance(balance.free, isKSM ? 12 : 10))
        if ((toBalance + parseFloat(amount)) <= 1) {
          throw new Error('minimum1Polkadot')
        }
      }
      const transfer = polkadotApi.tx.balances.transfer(toAddress, convertBalanceToWei(amount, isKSM ? 12 : 10))

      const hash = await transfer.signAndSend(pairPolkadot)
      return typeof hash === 'object' ? hash.toHex() : hash
    } catch (error) {
      throw new Error(error)
    }
  }

  // Near
  async _createNearWallet (chain) {
    const { publicKey, privateKey } = await this._genNearKey()
    const recoveryKeyPair = KeyPair.fromString(privateKey)
    const implicitAccountId = Buffer.from(recoveryKeyPair.publicKey.data).toString('hex')
    return { privateKey, publicKey, address: implicitAccountId, mnemonic: this.mnemonic, chain }
  }

  async _getBalanceNearWallet (address, chain) {
    const { publicKey, privateKey } = await this._genNearKey()

    const near = await createConnectionInstance(chain, false, {
      privateKey,
      publicKey,
      address
    })


    try {
      const account = await near.account(address)
      const { total: balance } = await account.getAccountBalance()
      let formatBalance = nearUtils.format.formatNearAmount(balance.toString())
      const isNeedFormat = formatBalance.indexOf(".") >= 0 && formatBalance.indexOf(",") >= 0
      if(isNeedFormat){
        formatBalance = parseFloat(formatBalance.split('.')[0].split(',').join('.')) 
      }
      return formatBalance
    } catch (e) {
      console.log('error', e)
      throw new Error(e)   
    }
  }

  async _sendFromNearWallet ({ toAddress, amount, chain }) {
    const { publicKey, privateKey } = await this._genNearKey()

    const recoveryKeyPair = KeyPair.fromString(privateKey)
    const address = Buffer.from(recoveryKeyPair.publicKey.data).toString('hex')

    const near = await createConnectionInstance(chain, false, {
      privateKey,
      publicKey,
      address
    })

    const account = await near.account(address)

    try {
      const formatAmount = nearUtils.format.parseNearAmount(amount.toString())
      const txts = await account.sendMoney(toAddress, formatAmount)
      return txts.transaction.hash
    } catch (e) {
      throw new Error(e)
    }
  }

  // TRX
  async _createTronWallet () {
    let tronPrivateKey = this.privateKey

    if (this.privateKey && this.privateKey.startsWith('0x')) {
      tronPrivateKey = this.privateKey.substring(2, getLength(this.privateKey))
    }

    if (!tronPrivateKey) {
      const seed = await this._genSeed()
      const nodeETH = ethers.utils.HDNode.fromSeed(seed).derivePath('m/44\'/60\'/0\'/0/0')

      tronPrivateKey = nodeETH.privateKey.substring(2, getLength(nodeETH.privateKey))
    }
    const tronAddress = tronWeb.address.fromPrivateKey(tronPrivateKey)

    const nodeWallet = {
      privateKey: tronPrivateKey,
      address: tronAddress,
      mnemonic: this.mnemonic,
      chain: CHAIN_TYPE.tron
    }

    return nodeWallet
  }

  async _getBalanceTronWallet (address, chain) {
    try {
      const balance = await tronWeb.trx.getBalance(address)
      return tronWeb.fromSun(balance)
    } catch (e) {
      return 0
    }
  }

  async _getTokenBalanceTronWallet ({ contractAddress, address, decimalToken, chain }) {
    try {
      const contract = await tronWeb.contract().at(contractAddress)

      const balance = await contract.balanceOf(address).call()

      const tokenBalance = convertWeiToBalance(balance, decimalToken)

      return tokenBalance
    } catch (e) {
      return 0
    }
  }

  _sendFromTronWallet ({ toAddress, amount, sendContract }) {
    const convertAmount = convertBalanceToWei(amount, 6)

    let realPrivateKey = this.privateKey
    if (this.privateKey.startsWith('0x')) {
      realPrivateKey = this.privateKey.substring(2, getLength(this.privateKey))
    }
    tronWeb.setPrivateKey(realPrivateKey)

    return new Promise(async (resolve, reject) => {
      if (sendContract) {
        if (tronWeb.isAddress(sendContract.address)) {
          tronWeb.contract().at(sendContract.address).then(async (contract) => {
            contract.transfer(toAddress, convertAmount).send({
              feeLimit: 1e9,
              callValue: 0,
              shouldPollResponse: false
            }).then(res => resolve(res)).catch(error => {
              console.log(error)
              reject(error)
            })
          }).catch(error => {
            console.log(error)
            reject(error)
          })
        } else {
          try {
            const tradeObj = await tronWeb.transactionBuilder.sendToken(toAddress, convertAmount, sendContract.address, sendContract.walletAddress)
            // Sign
            const signedTxts = await tronWeb.trx.sign(tradeObj, realPrivateKey)
            // Receive
            const receipt = await tronWeb.trx.sendRawTransaction(signedTxts)
            resolve(receipt.transaction.txID)
          } catch (e) {
            console.log(e)
            reject(e)
          }

          return false
        }
      } else {
        tronWeb.trx.sendTransaction(toAddress, convertAmount, realPrivateKey).then(result => {
          resolve(result.transaction.txID)
        }).catch(error => {
          console.log(error)
          reject(error)
        })
      }
    })
  }

  //* *** Binance */
  async _createBinanceWallet (chain) {
    let derivePath = '44\'/714\'/0\'/0/0'

    if (chain === CHAIN_TYPE.thor) {
      derivePath = "44'/931'/0'/0/0"
    }

    if (chain === CHAIN_TYPE.cosmos) {
      derivePath = "44'/118'/0'/0/0"
    }

    if (chain === CHAIN_TYPE.terra) {
      derivePath = "44'/330'/0'/0/0"
    }

    if (chain === CHAIN_TYPE.kava) {
      derivePath = "m/44'/459'/0'/0/0"
    }

    if (chain === CHAIN_TYPE.band) {
      derivePath = "m/44'/494'/0'/0/0"
    }

    if (chain === CHAIN_TYPE.persistence) {
      derivePath = "m/44'/750'/0'/0/0"
    }

    const seed = await this._genSeed()
    const master = bip32.fromSeed(seed)
    const nodeBNB = master.derivePath(derivePath)
    const bnbPrivateKey = nodeBNB.privateKey.toString('hex')
    const bnbAddress = this._getAddress(nodeBNB.publicKey, CHAIN_TYPE[chain])
    const nodeWallet = {
      privateKey: bnbPrivateKey,
      address: bnbAddress,
      chain,
      mnemonic: this.seed ? this.seed.mnemonic : this.mnemonic
    }

    return nodeWallet
  }

  async _getBalanceBinanceWallet (address, chain, assets) {
    if (COSMOS_RELATIVE_CHAIN.includes(chain)) {
      const client = new CosmosServices({ chain })

      const balance = await client.getBalance({ address })

      return balance || 0
    }

    const bnbClient = await createConnectionInstance(chain)
    const balance = await bnbClient.getBalance(address)
    if (getLength(balance) > 0) {
      const findBNB = balance.find(item => item.symbol === 'BNB')
      return (findBNB.free)
    } else {
      return 0
    }
  }

  _getTokenBalanceBinanceWallet () { }

  async _sendFromBinanceWallet ({ toAddress, amount, sendContract, gasLimit, chain, memo }) {
    // Cosmos
    if (COSMOS_RELATIVE_CHAIN.includes(chain)) {
      const client = new CosmosServices({ chain })

      try {
        const response = await client.transfer({ toAddress, amount, chain, privateKey: this.privateKey, mnemonic: this.mnemonic, memo })

        return response
      } catch (e) {
        return Promise.reject(e)
      }
    }

    const bnbClient = await createConnectionInstance(chain)
    const bnbAccount = bnbClient.recoverAccountFromPrivateKey(this.privateKey)
    bnbClient.setPrivateKey(this.privateKey)
    return new Promise((resolve, reject) => {
      bnbClient.transfer(bnbAccount.address, toAddress, parseFloat(amount), 'BNB').then((result) => {
        if (result.status === 200) {
          resolve(result.result[0].hash)
        } else {
          reject(result)
          console.error('error', result)
        }
      }).catch((error) => {
        console.error('error', error)
        reject(error)
      })
    })
  }

  // Ultils Functions

  async estimateGasTxs (rawTransaction, web3) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      web3.eth.estimateGas(rawTransaction).then(res => {
        resolve(res)
      }).catch((err) => {
        reject(err)
      })
    })
  }

  async _genNearKey () {
    const seed = await this._genSeed()
    const NEAR_PATH = "m/44'/397'/0'"
    const { key } = derivePath(NEAR_PATH, seed.toString('hex'))
    const keyPairNear = nacl.sign.keyPair.fromSeed(key)
    const publicKey = 'ed25519:' + bs58.encode(Buffer.from(keyPairNear.publicKey))
    const privateKey = 'ed25519:' + bs58.encode(Buffer.from(keyPairNear.secretKey))

    return { publicKey, privateKey }
  }

  async _postBaseSendTxs (arrSend, isWaitDone, chain, onConfirmTracking) {
    const CHAIN_ID = {
      [`${CHAIN_TYPE.avax}ID`]: `0xa86${this.__DEV__ ? 'a' : '9'}`,
      [`${CHAIN_TYPE.tomo}ID`]: `0x${this.__DEV__ ? '88' : '89'}`,
      [`${CHAIN_TYPE.ether}ID`]: this.__DEV__ || this.__ETHER__ ? '0x2A' : '0x1',
      [`${CHAIN_TYPE.heco}ID`]: `0x${this.__DEV__ ? '256' : '128'}`,
      [`${CHAIN_TYPE.binanceSmart}ID`]: '0x38',
      [`${CHAIN_TYPE.fantom}ID`]: '0xFA',
      [`${CHAIN_TYPE.matic}ID`]: '0x89'
    }
    const { web3, provider } = await createConnectionInstance(chain, true, null, this.infuraKey, this.__DEV__)

    if (!this.privateKey) {
      throw new Error('Please provide your Private Key')
    }
    const gasStation = new EtherGasStation({ apiServices: this.apiServices })
    const ethWallet = new ethers.Wallet(this.privateKey, provider)
    const nonce = await web3.eth.getTransactionCount(ethWallet.address)
    const gasWeb3 = await gasStation.getGasStationFull(chain)
    let gasPriceDefault = gasWeb3 ? Number(gasWeb3.standard) : null
    gasPriceDefault = converter.decToHex((gasPriceDefault ? convertBalanceToWei(gasPriceDefault, 9) : convertBalanceToWei(25, 9)))
    const promise = arrSend.map(async (item, index) => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve, reject) => {
        const { to, data, gasPrice, gas, gasLimit, value, percent, valueNoConvert, nounce, valueDirect } = item

        const rawTransaction = {
          nonce: (nounce || nonce) + index,
          to,
          from: ethWallet.address,
          gasPrice: gasPriceDefault,
          data,
          value: 0,
          chainId: CHAIN_ID[chain + 'ID']
        }

        if (gasPrice) {
          rawTransaction.gasPrice = gasPrice
        } else {
          if (percent) {
            rawTransaction.gasPrice = gasPriceDefault * percent
          }
        }

        if (value || valueNoConvert) {
          rawTransaction.value = converter.decToHex(valueNoConvert || convertBalanceToWei(value))
        }

        if (valueDirect) {
          rawTransaction.value = valueDirect
        }
        if (gas || gasLimit) {
          try {
            rawTransaction.gasLimit = gas || gasLimit

            if (!this.__DEV__ && ![CHAIN_TYPE.avax, CHAIN_TYPE.matic].includes(chain)) {
              delete rawTransaction.chainId
            }
            delete rawTransaction.from

            if (!rawTransaction.to) delete rawTransaction.to
            delete rawTransaction.value

            const signedTransaction = await ethWallet.sign(rawTransaction)

            let hashTxs
            web3.eth.sendSignedTransaction(signedTransaction, (error, result) => {
              if (error) {
                reject(error)
              } else {
                hashTxs = result
                !isWaitDone && resolve(result)
              }
            }).on('confirmation', (confirms, receipt) => {
              onConfirmTracking && onConfirmTracking(hashTxs, confirms + 1)
            }).then(() => {
            // callback && callback(hashTxs)
              isWaitDone && resolve(hashTxs)
            }).catch(error => {
              console.log(error)
              isWaitDone && resolve(hashTxs)
            })
          } catch (error) {
            console.log('error here', error)
          }
        } else {
          this.estimateGasTxs(rawTransaction, web3).then(async (gasLimit) => {
            rawTransaction.gasLimit = item.gasLimit ? converter.decToHex(item.gasLimit) : '0x' + gasLimit.toString(16)

            if (!this.__DEV__ && ![CHAIN_TYPE.avax, CHAIN_TYPE.matic].includes(chain)) {
              delete rawTransaction.chainId
            }

            delete rawTransaction.from
            const signedTransaction = await ethWallet.sign(rawTransaction)
            let hashTxs
            web3.eth.sendSignedTransaction(signedTransaction, (error, result) => {
              if (error) {
                reject(error)
              } else {
                hashTxs = result
                !isWaitDone && resolve(result)
              }
            }).on('confirmation', (confirms, receipt) => {
              onConfirmTracking && onConfirmTracking(hashTxs, confirms + 1)
            }).then(() => {
              // callback && callback(hashTxs)
              isWaitDone && resolve(hashTxs)
            }).catch(error => {
              console.log(error)
              isWaitDone && resolve(hashTxs)
            })
          }).catch((err) => {
            console.log('some error', err)
            reject(err)
          })
        }
      })
    })

    try {
      const results = await Promise.all(promise)
      return results
    } catch (e) {
      throw new Error(e)
    }
  }

  _transfer ({ source, destination, amount, owner }) {
    const keys = [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ]
    return new TransactionInstruction({
      keys,
      data: this._encodeTokenInstructionData({
        transfer: { amount }
      }),
      programId: TOKEN_PROGRAM_ID
    })
  }

  _encodeTokenInstructionData (instruction) {
    const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'))
    LAYOUT.addVariant(
      0,
      BufferLayout.struct([
        BufferLayout.u8('decimals'),
        BufferLayout.blob(32, 'mintAuthority'),
        BufferLayout.u8('freezeAuthorityOption'),
        BufferLayout.blob(32, 'freezeAuthority')
      ]),
      'initializeMint'
    )
    LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount')
    LAYOUT.addVariant(
      3,
      BufferLayout.struct([BufferLayout.nu64('amount')]),
      'transfer'
    )
    LAYOUT.addVariant(
      7,
      BufferLayout.struct([BufferLayout.nu64('amount')]),
      'mintTo'
    )
    LAYOUT.addVariant(
      8,
      BufferLayout.struct([BufferLayout.nu64('amount')]),
      'burn'
    )
    const instructionMaxSpan = Math.max(
      ...Object.values(LAYOUT.registry).map((r) => r.span)
    )

    const b = Buffer.alloc(instructionMaxSpan)
    const span = LAYOUT.encode(instruction, b)
    return b.slice(0, span)
  }

  async _awaitTransactionSignatureConfirmation (
    txid,
    timeout = 15000
  ) {
    let done = false
    const result = await new Promise((resolve, reject) => {
      (async () => {
        setTimeout(() => {
          if (done) {
            return
          }
          done = true
          console.log('Timed out for txid', txid)
          Promise.reject(new Error(JSON.stringify({ timeout: true })))
        }, timeout)
        try {
          this.solanaConnection.onSignature(
            txid,
            (result) => {
              console.log('WS confirmed', txid, result)
              done = true
              if (result.err) {
                reject(result.err)
              } else {
                resolve(result)
              }
            },
            'recent'
          )
          console.log('Set up WS connection', txid)
        } catch (e) {
          done = true
          console.log('WS error in setup', txid, e)
        }
        while (!done) {
          // eslint-disable-next-line no-loop-func
          (async () => {
            try {
              const signatureStatuses = await this.solanaConnection.getSignatureStatuses([
                txid
              ])
              const result = signatureStatuses && signatureStatuses.value[0]
              if (!done) {
                if (!result) {
                  console.log('REST null result for', txid, result)
                } else if (result.err) {
                  console.log('REST error for', txid, result)
                  done = true
                  reject(result.err)
                } else if (!result.confirmations) {
                  console.log('REST no confirmations for', txid, result)
                  done = true
                  resolve(result)
                } else {
                  console.log('REST confirmation for', txid, result)
                  done = true
                  resolve(result)
                }
              }
            } catch (e) {
              if (!done) {
                console.log('REST connection error: txid', txid, e)
              }
            }
          })()
          await sleep(300)
        }
      })()
    })
    done = true
    return result
  }

  async _genSeed (returnProcess = false, isBinance = false) {
    const { mnemonic } = this

    const processMnemonic = mnemonic || (isBinance ? bip39.generateMnemonic() : ethers.utils.HDNode.entropyToMnemonic(ethers.utils.randomBytes(16)))

    this.mnemonic = processMnemonic

    if (returnProcess) {
      return processMnemonic
    }

    if (this.seed && this.seed.mnemonic === mnemonic) {
      return this.seed.seed
    }

    const seed = await bip39.mnemonicToSeed(processMnemonic)

    this.seed = {
      seed,
      mnemonic: processMnemonic
    }

    return seed
  }

  _chainActionFunction (chain, action) {
    switch (chain) {
      case CHAIN_TYPE.ether:
      case CHAIN_TYPE.heco:
      case CHAIN_TYPE.binanceSmart:
      case CHAIN_TYPE.avax:
      case CHAIN_TYPE.avaxX:
      case CHAIN_TYPE.tomo:
      case CHAIN_TYPE.celo:
      case CHAIN_TYPE.fantom:
      case CHAIN_TYPE.matic:
        return this[`_${action}EthWallet`]
      case CHAIN_TYPE.solana:
        return this[`_${action}SolWallet`]
      case CHAIN_TYPE.polkadot:
      case CHAIN_TYPE.kusama:
        return this[`_${action}DotWallet`]
      case CHAIN_TYPE.near:
        return this[`_${action}NearWallet`]
      case CHAIN_TYPE.tron:
        return this[`_${action}TronWallet`]
      case CHAIN_TYPE.binance:
      case CHAIN_TYPE.thor:
      case CHAIN_TYPE.cosmos:
      case CHAIN_TYPE.kava:
      case CHAIN_TYPE.terra:
      case CHAIN_TYPE.band:
      case CHAIN_TYPE.persistence:
        return this[`_${action}BinanceWallet`]
      default:
        throw new Error('Currently, we didn\'t support your input chain')
    }
  }

  _checkExists (chainSearch) {
    if (typeof chainSearch === 'object') {
      let flag = true
      chainSearch.forEach(it => {
        if (!SUPPORTED_CHAIN.includes(it) && it !== CHAIN_TYPE.multiChain) {
          flag = false
        }
        return false
      })

      return flag
    }

    return !!SUPPORTED_CHAIN.find(chain => chain === chainSearch)
  }

  async _getBnBAddressFromPublicKey () {
    return ''
  }

  _getAddress (publicKey, prefix = 'thor') {
    const hash = crypto.createHash('sha256')
      .update(publicKey)
      .digest()

    const address = new Ripemd160().update(hash).digest()
    const words = bech32.toWords(address)

    return bech32.encode(prefix, words)
  }
}

export default Wallet
