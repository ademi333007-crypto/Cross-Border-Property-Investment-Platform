import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, optionalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PROPERTY_ID = 101;
const ERR_INVALID_DOC_TYPE = 102;
const ERR_INVALID_HASH = 103;
const ERR_INVALID_JURISDICTION = 104;
const ERR_INVALID_STATUS = 105;
const ERR_INVALID_TIMESTAMP = 106;
const ERR_RECORD_ALREADY_EXISTS = 107;
const ERR_RECORD_NOT_FOUND = 108;
const ERR_ORACLE_NOT_VERIFIED = 109;
const ERR_INVALID_METADATA = 110;
const ERR_INVALID_EXPIRY = 111;
const ERR_RECORD_EXPIRED = 112;
const ERR_INVALID_UPDATE = 113;
const ERR_MAX_RECORDS_EXCEEDED = 114;
const ERR_INVALID_CURRENCY = 115;
const ERR_INVALID_LOCATION = 116;
const ERR_INVALID_OWNER = 117;
const ERR_INVALID_VERIFIER = 118;
const ERR_AUTHORITY_NOT_SET = 119;
const ERR_INVALID_FEE = 120;
const ERR_INSUFFICIENT_FEE = 121;
const ERR_TRANSFER_FAILED = 122;
const ERR_INVALID_PARAM = 123;

interface LegalRecord {
  hash: string;
  timestamp: number;
  issuer: string;
  status: string;
  jurisdiction: string;
  metadata: string;
  expiry: number | null;
  owner: string;
  currency: string;
  location: string;
}

interface RecordUpdate {
  updateHash: string;
  updateTimestamp: number;
  updater: string;
  previousStatus: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class LegalRecordsMock {
  state: {
    nextRecordId: number;
    maxRecords: number;
    registrationFee: number;
    authorityContract: string | null;
    oraclePrincipal: string | null;
    governanceThreshold: number;
    legalRecords: Map<string, LegalRecord>;
    recordsByHash: Map<string, { propertyId: number; docType: string }>;
    recordUpdates: Map<string, RecordUpdate>;
  } = {
    nextRecordId: 0,
    maxRecords: 10000,
    registrationFee: 500,
    authorityContract: null,
    oraclePrincipal: null,
    governanceThreshold: 51,
    legalRecords: new Map(),
    recordsByHash: new Map(),
    recordUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1ORACLE";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextRecordId: 0,
      maxRecords: 10000,
      registrationFee: 500,
      authorityContract: null,
      oraclePrincipal: null,
      governanceThreshold: 51,
      legalRecords: new Map(),
      recordsByHash: new Map(),
      recordUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1ORACLE";
    this.stxTransfers = [];
  }

  getRecordKey(propertyId: number, docType: string): string {
    return `${propertyId}-${docType}`;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === this.caller) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setOraclePrincipal(oracle: string): Result<boolean> {
    if (oracle === this.caller) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.caller !== this.state.authorityContract) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.oraclePrincipal = oracle;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (newFee <= 0) return { ok: false, value: ERR_INVALID_FEE };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  setMaxRecords(newMax: number): Result<boolean> {
    if (newMax <= this.state.maxRecords) return { ok: false, value: ERR_INVALID_PARAM };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.maxRecords = newMax;
    return { ok: true, value: true };
  }

  registerLegalRecord(
    propertyId: number,
    docType: string,
    docHash: string,
    jurisdiction: string,
    metadata: string,
    expiry: number | null,
    currency: string,
    location: string
  ): Result<boolean> {
    if (this.state.nextRecordId >= this.state.maxRecords) return { ok: false, value: ERR_MAX_RECORDS_EXCEEDED };
    if (propertyId <= 0) return { ok: false, value: ERR_INVALID_PROPERTY_ID };
    if (!docType || docType.length > 32) return { ok: false, value: ERR_INVALID_DOC_TYPE };
    if (docHash.length !== 64) return { ok: false, value: ERR_INVALID_HASH };
    if (jurisdiction.length !== 3) return { ok: false, value: ERR_INVALID_JURISDICTION };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (expiry !== null && expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (!["USD", "EUR", "STX"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: ERR_ORACLE_NOT_VERIFIED };
    if (this.state.authorityContract === null) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    const key = this.getRecordKey(propertyId, docType);
    if (this.state.legalRecords.has(key)) return { ok: false, value: ERR_RECORD_ALREADY_EXISTS };
    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });
    const record: LegalRecord = {
      hash: docHash,
      timestamp: this.blockHeight,
      issuer: this.caller,
      status: "valid",
      jurisdiction,
      metadata,
      expiry,
      owner: this.caller,
      currency,
      location,
    };
    this.state.legalRecords.set(key, record);
    this.state.recordsByHash.set(docHash, { propertyId, docType });
    this.state.nextRecordId++;
    return { ok: true, value: true };
  }

  updateRecordStatus(
    propertyId: number,
    docType: string,
    newStatus: string,
    newHash: string | null
  ): Result<boolean> {
    const key = this.getRecordKey(propertyId, docType);
    const record = this.state.legalRecords.get(key);
    if (!record) return { ok: false, value: ERR_RECORD_NOT_FOUND };
    if (!["valid", "expired", "disputed", "revoked"].includes(newStatus)) return { ok: false, value: ERR_INVALID_STATUS };
    if (newHash !== null && newHash.length !== 64) return { ok: false, value: ERR_INVALID_HASH };
    if (this.caller !== this.state.oraclePrincipal) return { ok: false, value: ERR_ORACLE_NOT_VERIFIED };
    const updatedRecord: LegalRecord = {
      ...record,
      status: newStatus,
      hash: newHash ?? record.hash,
      timestamp: this.blockHeight,
    };
    this.state.legalRecords.set(key, updatedRecord);
    this.state.recordUpdates.set(key, {
      updateHash: newHash ?? record.hash,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      previousStatus: record.status,
    });
    return { ok: true, value: true };
  }

  verifyRecord(propertyId: number, docType: string): Result<{ valid: boolean; details: LegalRecord }> {
    const key = this.getRecordKey(propertyId, docType);
    const record = this.state.legalRecords.get(key);
    if (!record) return { ok: false, value: ERR_RECORD_NOT_FOUND };
    if (record.expiry !== null && this.blockHeight > record.expiry) return { ok: false, value: ERR_RECORD_EXPIRED };
    if (record.status !== "valid") return { ok: false, value: ERR_INVALID_STATUS };
    return { ok: true, value: { valid: true, details: record } };
  }

  revokeRecord(propertyId: number, docType: string): Result<boolean> {
    return this.updateRecordStatus(propertyId, docType, "revoked", null);
  }

  getRecordCount(): Result<number> {
    return { ok: true, value: this.state.nextRecordId };
  }

  checkRecordExistence(hash: string): Result<boolean> {
    return { ok: true, value: this.state.recordsByHash.has(hash) };
  }
}

describe("LegalRecordsVerification", () => {
  let contract: LegalRecordsMock;

  beforeEach(() => {
    contract = new LegalRecordsMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2AUTH");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2AUTH");
  });

  it("rejects setting authority if caller is invalid", () => {
    const result = contract.setAuthorityContract("ST1ORACLE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets oracle principal successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setOraclePrincipal("ST3ORACLE");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.oraclePrincipal).toBe("ST3ORACLE");
  });

  it("rejects setting oracle if not authority", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setOraclePrincipal("ST3ORACLE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
  });

  it("rejects invalid registration fee", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setRegistrationFee(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_FEE);
  });

  it("rejects registration if not oracle", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setOraclePrincipal("ST3ORACLE");
    const result = contract.registerLegalRecord(
      1,
      "deed",
      "a".repeat(64),
      "USA",
      "Test metadata",
      null,
      "USD",
      "New York"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ORACLE_NOT_VERIFIED);
  });

  it("rejects invalid hash length", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setOraclePrincipal("ST1ORACLE");
    const result = contract.registerLegalRecord(
      1,
      "deed",
      "short",
      "USA",
      "Test metadata",
      null,
      "USD",
      "New York"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects update for non-existent record", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.setOraclePrincipal("ST1ORACLE");
    const result = contract.updateRecordStatus(99, "deed", "disputed", null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_RECORD_NOT_FOUND);
  });
});