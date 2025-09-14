(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PROPERTY-ID u101)
(define-constant ERR-INVALID-DOC-TYPE u102)
(define-constant ERR-INVALID-HASH u103)
(define-constant ERR-INVALID-JURISDICTION u104)
(define-constant ERR-INVALID-STATUS u105)
(define-constant ERR-INVALID-TIMESTAMP u106)
(define-constant ERR-RECORD-ALREADY-EXISTS u107)
(define-constant ERR-RECORD-NOT-FOUND u108)
(define-constant ERR-ORACLE-NOT-VERIFIED u109)
(define-constant ERR-INVALID-METADATA u110)
(define-constant ERR-INVALID-EXPIRY u111)
(define-constant ERR-RECORD-EXPIRED u112)
(define-constant ERR-INVALID-UPDATE u113)
(define-constant ERR-MAX-RECORDS-EXCEEDED u114)
(define-constant ERR-INVALID-CURRENCY u115)
(define-constant ERR-INVALID-LOCATION u116)
(define-constant ERR-INVALID-OWNER u117)
(define-constant ERR-INVALID-VERIFIER u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-FEE u120)
(define-constant ERR-INSUFFICIENT-FEE u121)
(define-constant ERR-TRANSFER-FAILED u122)
(define-constant ERR-INVALID-PARAM u123)
(define-data-var next-record-id uint u0)
(define-data-var max-records uint u10000)
(define-data-var registration-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var oracle-principal (optional principal) none)
(define-data-var governance-threshold uint u51)
(define-map legal-records
  { property-id: uint, doc-type: (string-ascii 32) }
  {
    hash: (string-ascii 64),
    timestamp: uint,
    issuer: principal,
    status: (string-ascii 16),
    jurisdiction: (string-ascii 3),
    metadata: (string-utf8 256),
    expiry: (optional uint),
    owner: principal,
    currency: (string-ascii 3),
    location: (string-utf8 100)
  })
(define-map records-by-hash (string-ascii 64) { property-id: uint, doc-type: (string-ascii 32) })
(define-map record-updates
  { property-id: uint, doc-type: (string-ascii 32) }
  {
    update-hash: (string-ascii 64),
    update-timestamp: uint,
    updater: principal,
    previous-status: (string-ascii 16)
  })
(define-read-only (get-record (property-id uint) (doc-type (string-ascii 32)))
  (map-get? legal-records { property-id: property-id, doc-type: doc-type }))
(define-read-only (get-record-updates (property-id uint) (doc-type (string-ascii 32)))
  (map-get? record-updates { property-id: property-id, doc-type: doc-type }))
(define-read-only (is-record-registered (hash (string-ascii 64)))
  (is-some (map-get? records-by-hash hash)))
(define-read-only (get-next-record-id)
  (var-get next-record-id))
(define-read-only (get-authority-contract)
  (var-get authority-contract))
(define-read-only (get-oracle-principal)
  (var-get oracle-principal))
(define-private (validate-property-id (id uint))
  (if (> id u0) (ok true) (err ERR-INVALID-PROPERTY-ID)))
(define-private (validate-doc-type (dtype (string-ascii 32)))
  (if (and (> (len dtype) u0) (<= (len dtype) u32)) (ok true) (err ERR-INVALID-DOC-TYPE)))
(define-private (validate-hash (h (string-ascii 64)))
  (if (is-eq (len h) u64) (ok true) (err ERR-INVALID-HASH)))
(define-private (validate-jurisdiction (j (string-ascii 3)))
  (if (is-eq (len j) u3) (ok true) (err ERR-INVALID-JURISDICTION)))
(define-private (validate-status (s (string-ascii 16)))
  (if (or (is-eq s "valid") (is-eq s "expired") (is-eq s "disputed") (is-eq s "revoked")) (ok true) (err ERR-INVALID-STATUS)))
(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height) (ok true) (err ERR-INVALID-TIMESTAMP)))
(define-private (validate-metadata (m (string-utf8 256)))
  (if (<= (len m) u256) (ok true) (err ERR-INVALID-METADATA)))
(define-private (validate-expiry (exp (optional uint)))
  (match exp e (if (> e block-height) (ok true) (err ERR-INVALID-EXPIRY)) (ok true)))
(define-private (validate-currency (cur (string-ascii 3)))
  (if (or (is-eq cur "USD") (is-eq cur "EUR") (is-eq cur "STX")) (ok true) (err ERR-INVALID-CURRENCY)))
(define-private (validate-location (loc (string-utf8 100)))
  (if (<= (len loc) u100) (ok true) (err ERR-INVALID-LOCATION)))
(define-private (validate-principal (p principal))
  (if (not (is-eq p tx-sender)) (ok true) (err ERR-NOT-AUTHORIZED)))
(define-private (is-oracle (p principal))
  (is-eq (some p) (var-get oracle-principal)))
(define-private (is-authority-set)
  (is-some (var-get authority-contract)))
(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)))
(define-public (set-oracle-principal (oracle principal))
  (begin
    (try! (validate-principal oracle))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (var-set oracle-principal (some oracle))
    (ok true)))
(define-public (set-registration-fee (new-fee uint))
  (begin
    (asserts! (> new-fee u0) (err ERR-INVALID-FEE))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (var-set registration-fee new-fee)
    (ok true)))
(define-public (set-max-records (new-max uint))
  (begin
    (asserts! (> new-max (var-get max-records)) (err ERR-INVALID-PARAM))
    (asserts! (is-eq tx-sender (unwrap! (var-get authority-contract) (err ERR-AUTHORITY-NOT-SET))) (err ERR-NOT-AUTHORIZED))
    (var-set max-records new-max)
    (ok true)))
(define-public (register-legal-record
  (property-id uint)
  (doc-type (string-ascii 32))
  (doc-hash (string-ascii 64))
  (jurisdiction (string-ascii 3))
  (metadata (string-utf8 256))
  (expiry (optional uint))
  (currency (string-ascii 3))
  (location (string-utf8 100)))
  (let ((record-key { property-id: property-id, doc-type: doc-type })
        (next-id (var-get next-record-id))
        (authority (var-get authority-contract)))
    (asserts! (< next-id (var-get max-records)) (err ERR-MAX-RECORDS-EXCEEDED))
    (try! (validate-property-id property-id))
    (try! (validate-doc-type doc-type))
    (try! (validate-hash doc-hash))
    (try! (validate-jurisdiction jurisdiction))
    (try! (validate-metadata metadata))
    (try! (validate-expiry expiry))
    (try! (validate-currency currency))
    (try! (validate-location location))
    (asserts! (is-none (map-get? legal-records record-key)) (err ERR-RECORD-ALREADY-EXISTS))
    (asserts! (is-oracle tx-sender) (err ERR-ORACLE-NOT-VERIFIED))
    (asserts! (is-authority-set) (err ERR-AUTHORITY-NOT-SET))
    (try! (stx-transfer? (var-get registration-fee) tx-sender (unwrap! authority (err ERR-AUTHORITY-NOT-SET))))
    (map-set legal-records record-key
      { hash: doc-hash,
        timestamp: block-height,
        issuer: tx-sender,
        status: "valid",
        jurisdiction: jurisdiction,
        metadata: metadata,
        expiry: expiry,
        owner: tx-sender,
        currency: currency,
        location: location })
    (map-set records-by-hash doc-hash record-key)
    (var-set next-record-id (+ next-id u1))
    (print { event: "record-registered", property-id: property-id, doc-type: doc-type })
    (ok true)))
(define-public (update-record-status
  (property-id uint)
  (doc-type (string-ascii 32))
  (new-status (string-ascii 16))
  (new-hash (optional (string-ascii 64))))
  (let ((record-key { property-id: property-id, doc-type: doc-type }))
    (match (map-get? legal-records record-key)
      record
      (begin
        (try! (validate-status new-status))
        (asserts! (is-oracle tx-sender) (err ERR-ORACLE-NOT-VERIFIED))
        (match new-hash h (try! (validate-hash h)) (ok true))
        (map-set legal-records record-key
          (merge record { status: new-status, hash: (default-to (get hash record) new-hash), timestamp: block-height }))
        (map-set record-updates record-key
          { update-hash: (default-to (get hash record) new-hash),
            update-timestamp: block-height,
            updater: tx-sender,
            previous-status: (get status record) })
        (print { event: "record-updated", property-id: property-id, doc-type: doc-type })
        (ok true))
      (err ERR-RECORD-NOT-FOUND))))
(define-public (verify-record
  (property-id uint)
  (doc-type (string-ascii 32)))
  (match (map-get? legal-records { property-id: property-id, doc-type: doc-type })
    record
    (let ((exp (get expiry record)))
      (match exp e (asserts! (<= block-height e) (err ERR-RECORD-EXPIRED)) (ok true))
      (asserts! (is-eq (get status record) "valid") (err ERR-INVALID-STATUS))
      (ok { valid: true, details: record }))
    (err ERR-RECORD-NOT-FOUND)))
(define-public (revoke-record
  (property-id uint)
  (doc-type (string-ascii 32)))
  (update-record-status property-id doc-type "revoked" none))
(define-public (get-record-count)
  (ok (var-get next-record-id)))
(define-public (check-record-existence (hash (string-ascii 64)))
  (ok (is-record-registered hash)))