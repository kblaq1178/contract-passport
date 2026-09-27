import {
  Cl,
  ClarityType,
  ClarityValue,
  SomeCV,
  TupleCV,
  UIntCV,
  contractPrincipalCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const CONTRACT = "contract-passport";

const accounts = simnet.getAccounts();
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// capability bit flags, mirroring the contract constants
const CAP = { swap: 1, lend: 2, borrow: 4, stake: 8, escrow: 16 } as const;

function registerArgs(
  targetName: string,
  name: string,
  version = "1.0.0",
  status = "active",
  capabilities: number = CAP.swap,
  targetAddress = wallet1,
): ClarityValue[] {
  return [
    contractPrincipalCV(targetAddress, targetName),
    stringAsciiCV(name),
    stringAsciiCV(version),
    stringAsciiCV(status),
    uintCV(capabilities),
  ];
}

function readPassport(targetName: string, targetAddress = wallet1) {
  return simnet.callReadOnlyFn(
    CONTRACT,
    "get-passport",
    [contractPrincipalCV(targetAddress, targetName)],
    wallet2,
  ).result;
}

function passportFields(targetName: string, targetAddress = wallet1): Record<string, ClarityValue> {
  const result = readPassport(targetName, targetAddress);
  expect(result).toHaveClarityType(ClarityType.OptionalSome);
  const passport = (result as SomeCV).value as TupleCV;
  return passport.value as Record<string, ClarityValue>;
}

function uintValue(cv: ClarityValue): bigint {
  return (cv as UIntCV).value;
}

function expectErrCode(result: ClarityValue, code: number) {
  expect(result).toBeErr(Cl.uint(code));
}

describe("contract-passport", () => {
  it("stores a passport on registration and echoes it back", () => {
    const before = simnet.blockHeight;
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("demo-dex-v1", "Demo DEX", "2.1.0", "active", CAP.swap + CAP.lend),
      wallet1,
    );
    expect(result).toBeOk(Cl.bool(true));

    const fields = passportFields("demo-dex-v1");
    expect(fields["contract-principal"]).toBePrincipal(`${wallet1}.demo-dex-v1`);
    expect(fields["name"]).toBeAscii("Demo DEX");
    expect(fields["version"]).toBeAscii("2.1.0");
    expect(fields["status"]).toBeAscii("active");
    expect(fields["owner"]).toBePrincipal(wallet1);
    expect(fields["capabilities"]).toBeUint(CAP.swap + CAP.lend);
    expect(fields["self-attested"]).toBeBool(true);
    expect(fields["update-count"]).toBeUint(0);
    expect(uintValue(fields["registered-at"])).toBeGreaterThan(BigInt(before));
    expect(fields["registered-at"]).toBeUint(uintValue(fields["updated-at"]));
  });

  it("returns none for a contract that was never registered", () => {
    expect(readPassport("ghost-contract")).toBeNone();
  });

  it("rejects a second registration of the same contract principal", () => {
    simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("dup-contract", "Duplicate"),
      wallet1,
    );
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("dup-contract", "Duplicate again"),
      wallet3,
    );
    expectErrCode(result, 101);
    expect(passportFields("dup-contract")["owner"]).toBePrincipal(wallet1);
  });

  it("lets only the owner update a passport", () => {
    simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("owned-contract", "Owned", "1.0.0", "active", CAP.stake),
      wallet1,
    );

    const blocked = simnet.callPublicFn(
      CONTRACT,
      "update-contract",
      registerArgs("owned-contract", "Stolen", "9.9.9", "deprecated", CAP.borrow),
      wallet2,
    );
    expectErrCode(blocked.result, 100);
    expect(passportFields("owned-contract")["name"]).toBeAscii("Owned");

    const allowed = simnet.callPublicFn(
      CONTRACT,
      "update-contract",
      registerArgs("owned-contract", "Owned v2", "2.0.0", "paused", CAP.stake + CAP.escrow),
      wallet1,
    );
    expect(allowed.result).toBeOk(Cl.bool(true));

    const fields = passportFields("owned-contract");
    expect(fields["name"]).toBeAscii("Owned v2");
    expect(fields["version"]).toBeAscii("2.0.0");
    expect(fields["status"]).toBeAscii("paused");
    expect(fields["capabilities"]).toBeUint(CAP.stake + CAP.escrow);
    expect(fields["owner"]).toBePrincipal(wallet1);
    expect(fields["update-count"]).toBeUint(1);
  });

  it("refuses to update a passport that does not exist", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "update-contract",
      registerArgs("never-registered", "Nothing"),
      wallet1,
    );
    expectErrCode(result, 102);
  });

  it("validates status, capabilities, name and version", () => {
    const badStatus = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("bad-status", "Bad", "1.0.0", "unknown"),
      wallet1,
    );
    expectErrCode(badStatus.result, 103);

    const emptyCapabilities = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("bad-caps", "Bad", "1.0.0", "active", 0),
      wallet1,
    );
    expectErrCode(emptyCapabilities.result, 104);

    const unknownCapabilityBit = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("bad-caps-bit", "Bad", "1.0.0", "active", 32),
      wallet1,
    );
    expectErrCode(unknownCapabilityBit.result, 104);

    const emptyName = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("bad-name", "", "1.0.0", "active"),
      wallet1,
    );
    expectErrCode(emptyName.result, 105);

    const emptyVersion = simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("bad-version", "Bad", "", "active"),
      wallet1,
    );
    expectErrCode(emptyVersion.result, 106);
  });

  it("decodes capabilities into names and rejects unknown contracts", () => {
    simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("multi-cap", "Multi", "1.0.0", "active", CAP.swap + CAP.borrow + CAP.escrow),
      wallet1,
    );
    const { result } = simnet.callReadOnlyFn(
      CONTRACT,
      "get-capabilities",
      [contractPrincipalCV(wallet1, "multi-cap")],
      wallet2,
    );
    expect(result).toBeOk(
      Cl.list([Cl.stringAscii("swap"), Cl.stringAscii("borrow"), Cl.stringAscii("escrow")]),
    );

    const missing = simnet.callReadOnlyFn(
      CONTRACT,
      "get-capabilities",
      [contractPrincipalCV(wallet1, "ghost-contract")],
      wallet2,
    ).result;
    expectErrCode(missing, 102);
  });

  it("keeps separate passports per contract principal", () => {
    simnet.callPublicFn(CONTRACT, "register-contract", registerArgs("alpha", "Alpha"), wallet1);
    simnet.callPublicFn(
      CONTRACT,
      "register-contract",
      registerArgs("beta", "Beta", "1.0.0", "deprecated", CAP.lend),
      wallet2,
    );

    expect(passportFields("alpha")["name"]).toBeAscii("Alpha");
    expect(passportFields("beta")["name"]).toBeAscii("Beta");
    expect(passportFields("beta")["owner"]).toBePrincipal(wallet2);
  });

  it("supports every status in the status model", () => {
    for (const status of ["active", "paused", "deprecated", "migrated"]) {
      const targetName = `status-${status}`;
      const { result } = simnet.callPublicFn(
        CONTRACT,
        "register-contract",
        registerArgs(targetName, `Status ${status}`, "1.0.0", status, CAP.swap),
        wallet1,
      );
      expect(result).toBeOk(Cl.bool(true));
      expect(passportFields(targetName)["status"]).toBeAscii(status);
    }
  });

  it("counts registrations and reports registration state", () => {
    const countBefore = simnet.callReadOnlyFn(CONTRACT, "get-passport-count", [], wallet1).result;
    expect(countBefore).toBeUint(0);

    expect(
      simnet.callReadOnlyFn(
        CONTRACT,
        "is-registered",
        [contractPrincipalCV(wallet1, "counted")],
        wallet1,
      ).result,
    ).toBeBool(false);

    simnet.callPublicFn(CONTRACT, "register-contract", registerArgs("counted", "Counted"), wallet1);

    expect(
      simnet.callReadOnlyFn(CONTRACT, "get-passport-count", [], wallet1).result,
    ).toBeUint(1);
    expect(
      simnet.callReadOnlyFn(
        CONTRACT,
        "is-registered",
        [contractPrincipalCV(wallet1, "counted")],
        wallet1,
      ).result,
    ).toBeBool(true);
  });
});
