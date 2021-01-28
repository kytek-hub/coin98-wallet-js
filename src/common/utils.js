import bigdecimal from 'bigdecimal'
import get from 'lodash/get'
import * as BufferLayout from 'buffer-layout'
import converter from 'hex2dec'

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
