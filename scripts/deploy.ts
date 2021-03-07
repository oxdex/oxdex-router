import { providers, Wallet, Contract, BigNumber, utils } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import OxDexRouter from '../build/OxDexRouter.json'
import WETHToken from "../build/ERC20.json";
import OxDexFactory from "oxdex-contract/build/OxDexFactory.json";
import { enpoint, mnemonic, factory, weth } from '../deploy.json'
import { createInterface } from 'readline'

const deployComfirm = (chainId: number, deployer: string, factory: string, weth: string) => {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    return new Promise((res, rej) => {
        let question = `Please confirm: deploy by ${deployer} on network ${chainId}\n`
        question += `the construct param: [${factory},${weth}](Y/n)`
        rl.question(question, (answer) => {
            try {
                if (answer === 'Y') {
                    res(null)
                } else {
                    rej('rejected')
                }
            } finally {
                rl.close()
            }
        })
    })
}

async function main() {
    const provider = new providers.JsonRpcProvider(enpoint)
    const signer = Wallet.fromMnemonic(mnemonic).connect(provider)

    const signerNonce = await signer.getTransactionCount()
    if (signerNonce != 1) {
        throw new Error('OxDexRouter should be deployed after OxDexFactory')
    }

    const signerBalance = await signer.getBalance()
    if (signerBalance.lt(BigNumber.from('200000000000000000'))) { // 0.2
        throw new Error('insufficient funds for deploying')
    }

    // check params
    {
        if (utils.getContractAddress({ from: signer.address, nonce: 0 }) != factory) {
            throw new Error("factory is not created by signer")
        }

        const wethContract = new Contract(weth, WETHToken.abi, provider)
        const wName = await wethContract.name()
        if (wName != "Wrapped HT") { // Heco
            throw new Error("Not a WHT contract: name check failed")
        }

        const wSymbol = await wethContract.symbol()
        if (wSymbol != "WHT") { // Heco
            throw new Error("Not a WHT contract: symbol check failed")
        }
        const wDecimal = await wethContract.decimals()
        if (wDecimal !== 18) { // Heco
            throw new Error("Not a WHT contract: decimal check failed")
        }
    }

    const { chainId } = await provider.getNetwork()
    await deployComfirm(chainId, signer.address, factory, weth)

    console.log('deploying...')
    const deploy = await deployContract(signer, OxDexRouter, [factory, weth])
    console.log('deployed at', deploy.address)
}

main().catch(console.log)
