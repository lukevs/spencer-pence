import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber } from "@ethersproject/bignumber";

import { SpencePence } from "../typechain";

const SPENCERS_BIRTHDAY_UTC = 675921600;
const SECONDS_PER_YEAR = 31557600;

async function timeTravelTo(utcSeconds: number) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [utcSeconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("Unit tests", function () {
  let birthdayBoy: SignerWithAddress;
  let notBirthdayBoy: SignerWithAddress;

  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    birthdayBoy = signers[1];
    notBirthdayBoy = signers[2];
  });

  describe("SpencePence", function () {
    let spencePence: SpencePence;

    async function asPence(amount: number) {
      return BigNumber.from(10)
        .pow(await spencePence.decimals())
        .mul(amount);
    }

    async function expectBalance(account: SignerWithAddress, amount: BigNumber) {
      const actualAmount = await spencePence.balanceOf(account.address);
      expect(actualAmount).to.equal(amount);
    }

    async function expectBirthdayBoyBalance(amountWithoutSupply: BigNumber) {
      await expectBalance(birthdayBoy, (await spencePence.totalSupply()).add(amountWithoutSupply));
    }

    beforeEach(async function () {
      const SpencePenceContract = await ethers.getContractFactory("SpencePence");
      spencePence = await SpencePenceContract.deploy(birthdayBoy.address);
    });

    it("should give the birthday boy the full supply on deploy", async function () {
      const latestBlockNumber = await ethers.provider.getBlockNumber();
      const latestBlockTimestamp = (await ethers.provider.getBlock(latestBlockNumber)).timestamp;
      const spencersAgeSeconds = latestBlockTimestamp - SPENCERS_BIRTHDAY_UTC;

      const expectedInitialSupply = (await asPence(1)).mul(spencersAgeSeconds).div(SECONDS_PER_YEAR);
      const actualInitialSupply = await spencePence.balanceOf(birthdayBoy.address);

      expect(actualInitialSupply).to.equal(expectedInitialSupply);
      expect(actualInitialSupply).to.equal(await spencePence.totalSupply());
    });

    it("should support transfers back and forth", async function () {
      await expectBirthdayBoyBalance(BigNumber.from(0));
      await expectBalance(notBirthdayBoy, BigNumber.from(0));

      const amountGivenAway = await asPence(15);
      const amountGivenBack = await asPence(10);
      const amountGivenAwayAgain = await asPence(20);

      await spencePence.connect(birthdayBoy).transfer(notBirthdayBoy.address, amountGivenAway);
      await expectBirthdayBoyBalance(amountGivenAway.mul(-1));
      await expectBalance(notBirthdayBoy, amountGivenAway);

      await spencePence.connect(notBirthdayBoy).transfer(birthdayBoy.address, amountGivenBack);
      await expectBirthdayBoyBalance(amountGivenBack.sub(amountGivenAway));
      await expectBalance(notBirthdayBoy, amountGivenAway.sub(amountGivenBack));

      await spencePence.connect(birthdayBoy).transfer(notBirthdayBoy.address, amountGivenAwayAgain);
      await expectBirthdayBoyBalance(amountGivenBack.sub(amountGivenAway).sub(amountGivenAwayAgain));
      await expectBalance(notBirthdayBoy, amountGivenAway.add(amountGivenAwayAgain).sub(amountGivenBack));
    });

    it("should not allow transfers larger than supply", async function () {
      await expect(
        spencePence.connect(birthdayBoy).transfer(notBirthdayBoy.address, await asPence(1000)),
      ).to.be.revertedWith("SpencePence: transfer amount exceeds balance");
      await expect(
        spencePence.connect(notBirthdayBoy).transfer(birthdayBoy.address, await asPence(1000)),
      ).to.be.revertedWith("SpencePence: transfer amount exceeds balance");
    });

    /**
     * Tests todo
     * - test that supply increases with spencer's age
     */
  });
});
