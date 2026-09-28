;; title: contract-passport
;; version: 1.0.0
;; summary: A lightweight, self-attested on-chain registry for Stacks smart contracts.
;; description:
;;   Contract Passport stores the plain metadata a registrant publishes about a
;;   Stacks contract: name, version, status, owner and declared capabilities, so
;;   readers can look a contract up before they interact with it.
;;
;;   This registry is SELF-ATTESTED. It does not audit, analyze, verify, score or
;;   endorse any contract, and it never inspects contract code. It only records
;;   what a registrant claims about a contract.
;;
;;   Anyone can register a passport. Only the address that registered a passport
;;   is allowed to update it afterwards.

;; ---------------------------------------------------------------------------
;; constants
;; ---------------------------------------------------------------------------

;; error codes
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-REGISTERED (err u101))
(define-constant ERR-NOT-REGISTERED (err u102))
(define-constant ERR-INVALID-STATUS (err u103))
(define-constant ERR-INVALID-CAPABILITIES (err u104))
(define-constant ERR-INVALID-NAME (err u105))
(define-constant ERR-INVALID-VERSION (err u106))

;; status model
(define-constant STATUS-ACTIVE "active")
(define-constant STATUS-PAUSED "paused")
(define-constant STATUS-DEPRECATED "deprecated")
(define-constant STATUS-MIGRATED "migrated")

;; capability bit flags, decoded by get-capabilities
(define-constant CAPABILITY-SWAP u1)
(define-constant CAPABILITY-LEND u2)
(define-constant CAPABILITY-BORROW u4)
(define-constant CAPABILITY-STAKE u8)
(define-constant CAPABILITY-ESCROW u16)
(define-constant CAPABILITY-ALL u31)

;; ---------------------------------------------------------------------------
;; data
;; ---------------------------------------------------------------------------

(define-data-var passport-count uint u0)

;; a passport is keyed by the principal of the contract it describes
(define-map passports
  principal
  {
    contract-principal: principal,
    name: (string-ascii 64),
    version: (string-ascii 16),
    status: (string-ascii 12),
    owner: principal,
    capabilities: uint,
    self-attested: bool,
    registered-at: uint,
    updated-at: uint,
    update-count: uint,
  }
)

;; ---------------------------------------------------------------------------
;; private functions
;; ---------------------------------------------------------------------------

(define-private (is-valid-name (name (string-ascii 64)))
  (> (len name) u0)
)

(define-private (is-valid-version (version (string-ascii 16)))
  (> (len version) u0)
)

(define-private (is-valid-status (status (string-ascii 12)))
  (or
    (is-eq status STATUS-ACTIVE)
    (is-eq status STATUS-PAUSED)
    (is-eq status STATUS-DEPRECATED)
    (is-eq status STATUS-MIGRATED)
  )
)

;; at least one known capability and no unknown bits set
(define-private (is-valid-capabilities (capabilities uint))
  (and
    (> capabilities u0)
    (is-eq capabilities (bit-and capabilities CAPABILITY-ALL))
  )
)

(define-private (capability-enabled (entry { bit: uint, mask: uint }))
  (> (bit-and (get bit entry) (get mask entry)) u0)
)

(define-private (capability-name (entry { bit: uint, mask: uint }))
  (if (is-eq (get bit entry) CAPABILITY-SWAP)
    "swap"
    (if (is-eq (get bit entry) CAPABILITY-LEND)
      "lend"
      (if (is-eq (get bit entry) CAPABILITY-BORROW)
        "borrow"
        (if (is-eq (get bit entry) CAPABILITY-STAKE) "stake" "escrow")
      )
    )
  )
)

;; ---------------------------------------------------------------------------
;; public functions
;; ---------------------------------------------------------------------------

;; Register a passport for a Stacks contract principal (address.contract-name).
;; The caller becomes the owner of the passport and is the only address allowed
;; to update it later. Clarity cannot prove who deployed another contract, so the
;; target is not resolved on-chain: metadata is self-attested and never verified.
(define-public (register-contract
    (target principal)
    (name (string-ascii 64))
    (version (string-ascii 16))
    (status (string-ascii 12))
    (capabilities uint)
  )
  (let ((height stacks-block-height))
    (asserts! (is-none (map-get? passports target)) ERR-ALREADY-REGISTERED)
    (asserts! (is-valid-name name) ERR-INVALID-NAME)
    (asserts! (is-valid-version version) ERR-INVALID-VERSION)
    (asserts! (is-valid-status status) ERR-INVALID-STATUS)
    (asserts! (is-valid-capabilities capabilities) ERR-INVALID-CAPABILITIES)
    (map-set passports target {
      contract-principal: target,
      name: name,
      version: version,
      status: status,
      owner: tx-sender,
      capabilities: capabilities,
      self-attested: true,
      registered-at: height,
      updated-at: height,
      update-count: u0,
    })
    (var-set passport-count (+ (var-get passport-count) u1))
    (ok true)
  )
)

;; Update the passport of a registered contract. Only the registered owner may
;; call this. registered-at is kept, updated-at and update-count are refreshed.
(define-public (update-contract
    (target principal)
    (name (string-ascii 64))
    (version (string-ascii 16))
    (status (string-ascii 12))
    (capabilities uint)
  )
  (match (map-get? passports target)
    passport (begin
      (asserts! (is-eq tx-sender (get owner passport)) ERR-NOT-AUTHORIZED)
      (asserts! (is-valid-name name) ERR-INVALID-NAME)
      (asserts! (is-valid-version version) ERR-INVALID-VERSION)
      (asserts! (is-valid-status status) ERR-INVALID-STATUS)
      (asserts! (is-valid-capabilities capabilities) ERR-INVALID-CAPABILITIES)
      (map-set passports (get contract-principal passport) (merge passport {
        name: name,
        version: version,
        status: status,
        capabilities: capabilities,
        updated-at: stacks-block-height,
        update-count: (+ (get update-count passport) u1),
      }))
      (ok true)
    )
    ERR-NOT-REGISTERED
  )
)

;; ---------------------------------------------------------------------------
;; read-only functions
;; ---------------------------------------------------------------------------

;; Full passport for a contract principal, or none when it was never registered.
(define-read-only (get-passport (target principal))
  (map-get? passports target)
)

;; Declared capabilities of a registered contract, as names instead of bits.
(define-read-only (get-capabilities (target principal))
  (match (map-get? passports target)
    passport (let ((mask (get capabilities passport)))
      (ok (map capability-name
        (filter capability-enabled (list
          { bit: CAPABILITY-SWAP, mask: mask }
          { bit: CAPABILITY-LEND, mask: mask }
          { bit: CAPABILITY-BORROW, mask: mask }
          { bit: CAPABILITY-STAKE, mask: mask }
          { bit: CAPABILITY-ESCROW, mask: mask }
        ))
      ))
    )
    ERR-NOT-REGISTERED
  )
)

;; Number of passports registered so far.
(define-read-only (get-passport-count)
  (var-get passport-count)
)

;; Convenience check for readers and UIs.
(define-read-only (is-registered (target principal))
  (is-some (map-get? passports target))
)
