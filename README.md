# @coin98/coin98-wallet-js
Minimal Library for handling wallet functions.

# Installation

     yarn add @coin98/coin98-wallet-js
     // NPM
     npm i @coin98/coin98-wallet-js

# Get Started

    import { Wallet } from '@coin98/coin98-wallet-js';
    const wallet = new Wallet({ ...restOptions })

## Options

    {
	    mnemonic?: <String>,
	    PrivateKey?: <String>,
	    __DEV__: <Boolean>,
	    apiServices: <BaseAPI Instance>,
	    infuraKey?: <String>, 
	    web3?: Web3 Instance
    }

* (?) is Optional
# Method

**getMnemonic()**: *String* : return current Mnemonic

**getPrivateKey()**: *String* : return current PrivateKey

**getSupportChains()**: *Array* : return Supported chains

**async  create (chain, options = { }, callback = null)** :  Array : return array of wallets

**async  getBalance (address, chain, callback)** : Number : return balance number

**async  getTokenBalance (contractAddress, address, decimalToken, chain, solTokenAddress, callback)** : {address, balance} : return balance of token

**async  send (toAddress, amount, sendContract, gas, chain, callback)**  : String : hash of sending