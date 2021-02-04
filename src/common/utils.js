import bigdecimal from 'bigdecimal'
import get from 'lodash/get'
import * as BufferLayout from 'buffer-layout'
import converter from 'hex2dec'
import { CHAIN_TYPE } from '../constants/chain_supports'

export const convertWeiToBalance = (strValue, iDecimal = 18) => {
  const multiplyNum = new bigdecimal.BigDecimal(Math.pow(10, iDecimal))
  const convertValue = new bigdecimal.BigDecimal(String(strValue))
  return convertValue.divide(multiplyNum).toString()
}

export const convertBalanceToWei = (strValue, iDecimal = 18) => {
  const multiplyNum = new bigdecimal.BigDecimal(Math.pow(10, iDecimal))
  const convertValue = new bigdecimal.BigDecimal(String(strValue))
  return multiplyNum.multiply(convertValue).toString().split('.')[0]
}

export const getStorage = (key) => {
  const dataLocal = localStorage.getItem(key)
  try {
    return JSON.parse(dataLocal)
  } catch (e) {
    return dataLocal
  }
}

export const setStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const getLength = str => {
  return get(str, 'length', 0)
}

export const ACCOUNT_LAYOUT = BufferLayout.struct([
  BufferLayout.blob(32, 'mint'),
  BufferLayout.blob(32, 'owner'),
  BufferLayout.nu64('amount'),
  BufferLayout.blob(93)
])

export const lowerCase = (value) => {
  return value ? value.toLowerCase() : value
}

export const upperCase = (value) => {
  return value ? value.toUpperCase() : value
}

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const zeroPadLeft = (text, length = 64) => {
  while (text.length < length) {
    text = '0' + text
  }
  return text
}

export const generateDataToken = (amount = 0, address) => {
  const transferOpCode = '0xa9059cbb'
  const ABIValueToTransfer = zeroPadLeft(converter.decToHex(amount.toString().split('.')[0]).replace('0x', ''), 64)

  if (address) {
    const ethNakedAddress = address.toLowerCase().replace('0x', '')
    const ABIAddressTarget = zeroPadLeft(ethNakedAddress)
    return transferOpCode + ABIAddressTarget + ABIValueToTransfer
  } else {
    return transferOpCode + ABIValueToTransfer
  }
}

export const renderFormatWallet = ({ mnemonic, name, chain, address, privateKey, isMulti = false, isActive = true }) => {
  return {
    address,
    privateKey,
    mnemonic,
    isMulti,
    name,
    isActive,
    chain
  }
}

export const checkAddressChain = (address, chain, selectedToken) => {
  if (chain === CHAIN_TYPE.tron) {
    const TronWeb = require('tronweb')
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      solidityNode: 'https://api.trongrid.io',
      eventServer: 'https://api.trongrid.io',
      privateKey: 'd1299bf83d9819560b90957253b6e481faf54f88374f0525b660dfa63a2b4b5c'
    })

    if (selectedToken.baseAddress === address) {
      return 'sameWalletError'
    }

    return tronWeb.isAddress(address)
  } else if (chain === CHAIN_TYPE.binance) {
    return address.startsWith('bnb')
  } else if (chain === CHAIN_TYPE.polkadot || chain === CHAIN_TYPE.kusama) {
    const { hexToU8a, isHex } = require('@polkadot/util')
    const { decodeAddress, encodeAddress } = require('@polkadot/keyring')

    const isValidAddressPolkadotAddress = () => {
      try {
        encodeAddress(
          isHex(address)
            ? hexToU8a(address)
            : decodeAddress(address)
        )
        return true
      } catch (error) {
        return false
      }
    }

    return isValidAddressPolkadotAddress()
  } else {
    return chain === CHAIN_TYPE.solana ? true : ((address.startsWith('0x') && address.length === 42) && validateAddress(address) && address !== blankCode)
  }
}

export const validateAddress = (strAddress) => {
  let reg = ''
  if (countDots(strAddress, '\\x') > 1) {
    reg = /^([A-Fa-f0-9_]+)$/
  } else {
    reg = /^([A-Fa-f0-9_x]+)$/
  }

  return reg.test(strAddress)
}

export const countDots = (strString, strLetter) => {
  const string = strString.toString()
  return (string.match(RegExp(strLetter, 'g')) || []).length
}
