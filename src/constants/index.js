import { PublicKey } from '@solana/web3.js'

import chainSupports, { CHAIN_TYPE } from './chains'

export const SUPPORTED_CHAIN = chainSupports

export const ETHER_RELATIVE_CHAIN = [CHAIN_TYPE.ether, CHAIN_TYPE.binanceSmart, CHAIN_TYPE.heco, CHAIN_TYPE.avax, CHAIN_TYPE.avaxX, CHAIN_TYPE.tomo, CHAIN_TYPE.fantom, CHAIN_TYPE.matic]

export const COSMOS_RELATIVE_CHAIN = [CHAIN_TYPE.cosmos, CHAIN_TYPE.thor, CHAIN_TYPE.band, CHAIN_TYPE.terra, CHAIN_TYPE.kava, CHAIN_TYPE.persistence]

export const DOT_RELATIVE_CHAIN = [CHAIN_TYPE.polkadot, CHAIN_TYPE.kusama]

export const SOLANA_RELATIVE_CHAIN = [CHAIN_TYPE.solana]

export const MIN_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
]

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
export const MEMO_PROGRAM_ID = new PublicKey(
  'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo'
)

export const AssetRune = {
  chain: CHAIN_TYPE.thor,
  symbol: 'RUNE',
  ticker: 'RUNE'
}
