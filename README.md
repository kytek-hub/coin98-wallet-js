# @coin98/coin98-js
Minimal Library for handling wallet functions.

# Installation

     yarn add @coin98/coin98-js
     // NPM
     npm i @coin98/coin98-js

# Get Started

    import { Wallet } from '@coin98/coin98-js';
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
**getChain()**: *String* :  return current chain
**getMnemonic()**: *String* : return current Mnemonic
**getPrivateKey()**: *String* : return current PrivateKey
**getSupportChains()**: *Array* : return Supported chains
