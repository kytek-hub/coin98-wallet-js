import { cosmosclient, rest, cosmos } from 'cosmos-client/cjs/index'
import { CHAIN_TYPE } from '../constants/chain_supports'

class CosmosSDK {
  constructor ({ network = 'testnet', clientUrl, chain = 'cosmos' }) {
    this.chain = chain
    this.network = network
    this.clientUrl = clientUrl || this._getDefaultClientUrl(chain)
    this.sdk = new cosmosclient.CosmosSDK(this.clientUrl.mainnet.node, this.getChainId())

    // Class Binding
    this.setPrefix = this.setPrefix.bind(this)
    this.validateAddress = this.validateAddress.bind(this)
    this.getChainId = this.getChainId.bind(this)
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
    const config = cosmosclient.config.bech32Prefix
    config.accAddr = this.chain
    this.prefix = this.chain
    cosmosclient.config.setBech32Prefix(config)
  }

  async getBalance ({ address = null, assets = [] }) {
    try {
      this.setPrefix()
      const accAddress = cosmosclient.AccAddress.fromString(address)
      return rest.cosmos.bank.balance(this.sdk, accAddress, null)
    } catch (e) {
      Promise.reject(e)
    }
  }

  async transfer ({
    privkey,
    publicKey,
    from,
    to,
    amount,
    asset = 'rune',
    memo = '',
    fee = {
      amount: [],
      gas: '200000'
    }
  }) {
    this.setPrefix()
    try {
      const account = await rest.cosmos.auth.account(this.sdk, from).then((res) => res.data.account && cosmosclient.codec.unpackAny(res.data.account))

      if (!(account instanceof cosmos.auth.v1beta1.BaseAccount)) {
        console.log(account)
        return
      }

      const msg = new cosmos.bank.v1beta1.MsgSend({
        from_address: from,
        to_address: to,
        amount: [{
          denom: asset,
          amount: amount.toString()
        }]
      })

      const txBody = new cosmos.tx.v1beta1.TxBody({
        messages: [cosmosclient.codec.packAny(msg)]
      })

      const authInfo = new cosmos.tx.v1beta1.AuthInfo({
        signer_infos: [
          {
            public_key: cosmosclient.codec.packAny(publicKey),
            mode_info: {
              single: {
                mode: cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT
              }
            },
            sequence: account
          }
        ],
        fee: {
          gas_limit: cosmosclient.Long.fromString(fee.gas)
        }
      })

      // Sign
      const txBuilder = new cosmosclient.TxBuilder(this.sdk, txBody, authInfo)
      const signDoc = txBuilder.signDoc(account.account_number)
      txBuilder.addSignature(privkey, signDoc)

      // Send
      const res = await rest.cosmos.tx.broadcastTx(this.sdk, {
        tx_bytes: txBuilder.txBytes(),
        mode: rest.cosmos.tx.BroadcastTxMode.Sync
      })
      return res
    } catch (e) {
      console.log('[Cosmos Send Error]: ', e)
      Promise.reject(e)
    }
  }

  validateAddress (address) {
    this.setPrefix()

    try {
      if (!address.startsWith(this.prefix)) {
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
  _getDefaultClientUrl (chain) {
    const clientUrls = {
      cosmos: {
        testnet: {
          node: 'http://lcd.gaia.bigdipper.live:1317',
          rpc: ''
        },
        mainnet: {
          node: 'https://api.cosmos.network',
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
          node: 'https://api.cosmos.network',
          rpc: ''
        }
      },
      kava: {
        testnet: {
          node: 'https://api.data-testnet-12000.kava.io',
          rpc: ''
        },
        mainnet: {
          node: 'https://api.kava.io',
          rpc: ''
        }
      }
    }
    return clientUrls[chain]
  }
}

export default CosmosSDK
