import * as cosmosclient from 'cosmos-client'
import { get } from 'lodash'
import { convertBalanceToWei, convertWeiToBalance } from '../common/utils'
import { CHAIN_TYPE } from '../constants/chain_supports'
import { Cosmos } from '@cosmostation/cosmosjs'
import message from '@cosmostation/cosmosjs/src/messages/proto'
import request from 'request'
import { bank } from 'cosmos-client/x/bank'
import { Client as ThorClient } from '@xchainjs/xchain-thorchain'
import { baseAmount } from '@xchainjs/xchain-util'

class CosmosSDK {
  constructor ({ network = 'testnet', clientUrl, chain = 'cosmos' }) {
    this.chain = chain
    this.network = network
    this.clientUrl = clientUrl || this._getDefaultClientUrl(chain)
    this.sdk = new cosmosclient.CosmosSDK(
      this.clientUrl.mainnet.node,
      this.getChainId()
    )
    this.decimal = this.chain === CHAIN_TYPE.cosmos ? 6 : 8

    // Class Binding
    this.setPrefix = this.setPrefix.bind(this)
    this.validateAddress = this.validateAddress.bind(this)
    this.getChainId = this.getChainId.bind(this)
    this.getBalance = this.getBalance.bind(this)
    this.transfer = this.transfer.bind(this)
    this._getDefaultChainSymbol = this._getDefaultChainSymbol.bind(this)
    this._getChainId = this._getChainId.bind(this)
    this._getPath = this._getPath.bind(this)
    this.broadcastThor = this.broadcastThor.bind(this)
  }

  getNetwork () {
    return this.network
  }

  getChainId () {
    if (this.network === 'testnet') {
      switch (this.chain) {
        case CHAIN_TYPE.cosmos:
          return 'gaia-3a'
        case CHAIN_TYPE.thor:
          return 'thorchain'
      }
    }

    switch (this.chain) {
      case CHAIN_TYPE.cosmos:
        return 'cosmoshub-3'
      case CHAIN_TYPE.thor:
        return 'thorchain'
    }
  }

  setPrefix () {
    const prefix = this.chain
    cosmosclient.AccAddress.setBech32Prefix(
      prefix,
      prefix + 'pub',
      prefix + 'valoper',
      prefix + 'valoperpub',
      prefix + 'valcons',
      prefix + 'valconspub'
    )
  }

  async getBalance ({ address = null, assets }) {
    try {
      this.setPrefix()
      const symbol = assets || this._getDefaultChainSymbol()
      const accAddress = cosmosclient.AccAddress.fromBech32(address)
      const response = await bank.balancesAddressGet(this.sdk, accAddress)
      const result = get(response, 'data.result', [])
      const findBalance = result.find(it => it.denom.toUpperCase() === symbol.toUpperCase())
      const balance = get(findBalance, 'amount', 0)
      return convertWeiToBalance(balance.toString(), this.decimal)
    } catch (e) {
      Promise.reject(e)
    }
  }

  async transfer ({
    privkey,
    publicKey,
    from,
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
    this.setPrefix()

    asset = asset || this._getDefaultChainSymbol()

    const amountWei = convertBalanceToWei(amount, this.decimal)

    const cosmos = new Cosmos(this.clientUrl.mainnet.node, this._getChainId())

    cosmos.setPath(this._getPath())

    cosmos.setBech32MainPrefix(this.chain)

    const address = cosmos.getAddress(mnemonic)
    const privKey = cosmos.getECPairPriv(mnemonic)
    const pubKeyAny = cosmos.getPubKeyAny(privKey)
    const accounts = await cosmos.getAccounts(address)

    const feeTxs =
      this.chain === CHAIN_TYPE.cosmos
        ? 50
        : convertBalanceToWei('0.02', this.decimal)

    if (accounts) {
      if (this.chain === CHAIN_TYPE.cosmos) {
        const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
          from_address: address,
          to_address: toAddress,
          amount: [{ denom: asset, amount: String(amountWei) }]
        })

        const msgSendAny = new message.google.protobuf.Any({
          type_url: '/cosmos.bank.v1beta1.MsgSend',
          // type: '',
          value: message.cosmos.bank.v1beta1.MsgSend.encode(msgSend).finish()
        })

        const txBody = new message.cosmos.tx.v1beta1.TxBody({
          messages: [msgSendAny],
          memo: ''
        })

        const signerInfo = new message.cosmos.tx.v1beta1.SignerInfo({
          public_key: pubKeyAny,
          mode_info: {
            single: {
              mode: message.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT
            }
          },
          sequence: accounts.account.sequence
        })

        const feeValue = new message.cosmos.tx.v1beta1.Fee({
          amount: [{ denom: asset, amount: String(feeTxs) }],
          gas_limit: 200000
        })

        const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({
          signer_infos: [signerInfo],
          fee: feeValue
        })

        const signedTxBytes = cosmos.sign(
          txBody,
          authInfo,
          accounts.account.account_number,
          privKey
        )

        const { tx_response: response } = await cosmos.broadcast(
          signedTxBytes,
          this.chain === CHAIN_TYPE.cosmos ? undefined : 'BROADCAST_MODE_ASYNC'
        )

        if (response.raw_log.length > 5) {
          throw new Error(response.raw_log)
        }

        return response.txhash || response.hash
      } else {
        // const wallet = createWalletFromMnemonic(mnemonic)

        // const tx = {
        //   fee,
        //   memo,
        //   msg: [{
        //     type: 'thorchain/MsgSend',
        //     value: {
        //       from_address: address,
        //       to_address: toAddress,
        //       amount: [{ denom: asset, amount: String(amountWei) }]
        //     }
        //   }]
        // }

        // const signMeta = {
        //   account_number: accounts.account.account_number,
        //   chain_id: this._getChainId(),
        //   sequence: accounts.account.sequence
        // }

        // const signedTxt = signTx(tx, signMeta, wallet)

        // // const privKeyBuffer = await this.sdk.generatePrivKeyFromMnemonic(mnemonic)
        // // const privKey = new cosmosclient.PrivKeySecp256k1(privKeyBuffer)
        // // const fromAddress = cosmosclient.AccAddress.fromPublicKey(privKey.getPubKey())
        // // const toAddr = cosmosclient.AccAddress.fromBech32(toAddress);

        // // const unSignedTx = await bank.accountsAddressTransfersPost(this.sdk, toAddr, {
        // //   base_req: {
        // //     from: fromAddress,
        // //     memo,
        // //     chain_id: this.getChainId(),
        // //     account_number: accounts.account.account_number,
        // //     sequence: accounts.account.sequence,
        // //     fees: fee,
        // //     simulate: false
        // //   },
        // //   amount: [{ denom: asset, amount: String(amountWei) }]
        // // })

        // // const signedStdTx = auth.signStdTx(
        // //   this.sdk,
        // //   privKey,
        // //   unSignedTx,
        // //   accounts.account.account_number,
        // //   accounts.account.sequence
        // // )

        // // const { data: result } = await auth.txsPost(this.sdk, signedTxt, 'block')
        // const result = await this.broadcastThor(signedTxt)
        // console.log('🚀 ~ file: cosmosClient.js ~ line 208 ~ CosmosSDK ~ result', result)

        const client = new ThorClient({ phrase: mnemonic, network: 'mainnet' })

        const resp = await client.transfer({
          asset: { chain: 'THOR', symbol: 'RUNE', ticker: 'RUNE' },
          amount: baseAmount(amountWei, this.decimal),
          recipient: toAddress,
          memo
        })

        return resp
      }
    }
  }

  broadcastThor (tx, mode = 'block') {
    const options = {
      method: 'POST',
      url: this.clientUrl.mainnet.node + '/txs',
      headers: { 'Content-Type': 'application/json' },
      body: { tx, mode },
      json: true
    }

    return new Promise(function (resolve, reject) {
      request(options, function (error, response, body) {
        if (error) return reject(error)
        try {
          resolve(body)
        } catch (e) {
          reject(e)
        }
      })
    })
  }

  validateAddress (address, prefix) {
    try {
      if (!address.startsWith(prefix)) {
        return false
      }

      return cosmosclient.AccAddress.fromString(address).toString() === address
    } catch (e) {
      return false
    }
  }

  getExplorerUrl () {
    const exploreUrl = {
      [CHAIN_TYPE.cosmos]: {
        testnet: 'https://gaia.bigdipper.live',
        mainnet: 'https://cosmos.bigdipper.live'
      },
      [CHAIN_TYPE.thor]: {
        testnet: 'https://testnet.thorchain.net',
        mainnet: 'https://testnet.thorchain.net'
      },
      [CHAIN_TYPE.terra]: {
        testnet: 'https://finder.terra.money/tequila-0004',
        mainnet: 'https://finder.terra.money/columbus-4'
      },
      [CHAIN_TYPE.kava]: {
        testnet: 'https://kavascan.com/',
        mainnet: 'https://kavascan.com/'
      }
    }

    return exploreUrl[this.chain][this.network]
  }

  getExplorerAddressUrl (address) {
    return `${this.getExplorerUrl()}/account/${address}`
  }

  getExplorerTxUrl (txID) {
    return `${this.getExplorerUrl()}/transactions/${txID}`
  }

  // Private Method
  _getDefaultChainSymbol () {
    switch (this.chain) {
      case CHAIN_TYPE.cosmos:
        return 'uatom'
      case CHAIN_TYPE.thor:
        return 'rune'
      case CHAIN_TYPE.terra:
        return 'luna'
      default:
        return null
    }
  }

  _getPath () {
    switch (this.chain) {
      case CHAIN_TYPE.thor:
        return "44'/931'/0'/0/0"
      case CHAIN_TYPE.terra:
        return "44'/330'/0'/0/0"
      case CHAIN_TYPE.kava:
        return "m/44'/459'/0'/0/0"
      default:
        return "44'/118'/0'/0/0"
    }
  }

  _getChainId () {
    switch (this.chain) {
      case CHAIN_TYPE.thor:
        return 'thorchain'
      default:
        return 'cosmoshub-4'
    }
  }

  _getDefaultClientUrl (chain) {
    const clientUrls = {
      cosmos: {
        testnet: {
          node: 'http://lcd.gaia.bigdipper.live:1317',
          rpc: ''
        },
        mainnet: {
          node: 'https://lcd-cosmos-app.cosmostation.io/',
          rpc: ''
        }
      },
      thor: {
        testnet: {
          node: 'https://testnet.thornode.thorchain.info',
          rpc: 'https://testnet.rpc.thorchain.info'
        },
        mainnet: {
          node: 'https://thornode.thorchain.info',
          rpc: 'https://rpc.thorchain.info'
        }
      },
      terra: {
        testnet: {
          node: 'https://lcd.terra.dev',
          rpc: ''
        },
        mainnet: {
          node: 'https://lcd.terra.dev',
          rpc: ''
        }
      },
      kava: {
        testnet: {
          node: 'https://api.data-testnet-12000.kava.io',
          rpc: ''
        },
        mainnet: {
          node: 'https://lcd-kava.cosmostation.io',
          rpc: ''
        }
      }
    }
    return clientUrls[chain]
  }
}

export default CosmosSDK
