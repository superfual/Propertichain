# Propertichain

Propertichain explores how smaller investors could participate in fractional ownership of existing Vietnamese apartments and shophouses and verify their share of rental income. Each unit has its own identity, valuation evidence and rental ledger. Vinhomes Grand Park is used as a case study.

- [Bilingual site](https://fual-property-rwa.phamphuanloc.chatgpt.site/)
- [Pilot walkthrough](https://fual-property-rwa.phamphuanloc.chatgpt.site/pilot-en.html#walkthrough)
- [Testnet evidence](https://fual-property-rwa.phamphuanloc.chatgpt.site/pilot-en.html#proof-v2)

## BNB Smart Chain Testnet

The first pilot on chain ID 97 anchored a price record, issued 1,000 simulated shares and paid 6,000,000 wei of tBNB in simulated rent to wallet A. A read-only call reverted on a duplicate claim. The transfer to wallet B was outside the completed on-chain run.

- [Testnet contract](https://testnet.bscscan.com/address/0x87d69bf71f8fbe69973ee915a24dfc1ce4c4e9e4)
- [Price anchor transaction](https://testnet.bscscan.com/tx/0x9c9f2040d26d5ff8c627d7ff5ddac00d59d759980adf28aa783ad7dedb61d274)
- [Settlement record](dist/origami-testnet-settlement.json)
- [Solidity rehearsal contract](rehearsal/Rehearsal.sol)

The pilot uses synthetic property records and test funds. It models ownership and rental rights for demonstration. The roadmap includes price expiry and emergency pause safeguards. The design has no platform token.

## Run locally

Serve the static site with `python3 -m http.server 8000 --directory dist` and open http://localhost:8000/. For the local EVM workflow, see [rehearsal instructions](rehearsal/README.md). Historical design and research details are in [project notes](PROJECT-NOTES.md).

Snapshot of deployed site source revision `961f82933beb42e8fb283c289422c3c73b932988`.

## Project logic and roadmap

The proposed workflow has three layers. Owners, property operators, banks and appraisers perform real-world work. Authorized parties attest to records and attach evidence. Smart contracts check permissions and conditions and record eligible actions.

Property valuation and rental income are tracked separately. Issuance is intended to be tied to each verified property and an approved share supply. Small investors could acquire a fraction of a property and receive the rental income attributable to their holdings. Crypto rent payments and settlement using property shares are research items.

The planned sequence is developer-owned completed inventory, iterative pilot testing and fixes, rollout within a developer group, then external B2B deployments. Pricing controls, emergency pause, custody, legal recognition and banking integrations require further implementation and validation.

Vinhomes Grand Park is an illustrative case study. Collaboration with Vingroup, Vinhomes or a bank has not been established. Directory units are synthetic and published planning references are dated research snapshots. Pilot contracts and controls are experimental.

## Tiếng Việt

Propertichain nghiên cứu cách chia nhỏ phần sở hữu của căn hộ và shophouse hiện hữu tại Việt Nam để nhà đầu tư vốn nhỏ có thể tiếp cận, đồng thời đối chiếu việc phân phối tiền thuê của từng căn trên BNB Chain. Giá trị bất động sản và dòng tiền cho thuê được theo dõi riêng.

Website có hai phiên bản Việt–Anh, dữ liệu nghiên cứu Grand Park, mô phỏng quy trình ba lớp, chatbot theo tài liệu dự án và hồ sơ pilot. Bản thử BSC Testnet đã ghi dấu vân tay hồ sơ giá, phát hành phần sở hữu mô phỏng và trả tiền thuê thử cho ví A. Kiểm tra nhận trùng được thực hiện bằng lệnh đọc eth_call. Lượt chuyển cho ví B chưa hoàn tất trên testnet. Kết quả chia tiền cho cả A và B trong hồ sơ là kết quả local EVM.

Tài liệu thiết kế ban đầu trong docs/ và PROJECT-NOTES.md được giữ theo mốc lịch sử. Các câu mô tả trạng thái ở thời điểm cũ cần được đọc cùng kết quả pilot hiện tại trên trang này.

## Repository map

- dist/ — static bilingual website, research data, wallet interface and pilot evidence.
- rehearsal/ — Solidity source, compilation script, local EVM checks and locked dependencies.
- wallet-qr/ — Binance Wallet connection source and locked dependencies. The bundled browser module is in dist/.
- docs/ — original design blueprint.

The initial GitHub snapshot contains the recoverable deployed source and its historical materials. Review the current pilot status above when evaluating completed features.

## V2 completed on BSC Testnet

Contract `0x1a08eade1f03cb5860935014828660f0b40faef3` issued 1,000 synthetic shares to A, transferred 400 to B, and settled a period closed explicitly by A. Binance Wallet was used for A and Trust Wallet for B in this run.

| Holder | Closing shares | Rent paid (wei tBNB) |
| --- | --- | --- |
| A | 600 | 4,352,203 |
| B | 400 | 1,647,796 |

The pool received 6,000,000 wei, paid 5,999,999 wei and retains 1 wei from integer rounding. Actual holding time explains the split. Both duplicate claims were independently rejected by read-only calls. Operator price revocation and pause/resume transactions are included in the evidence. A historical pause rejection was independently verified. The RPC could not replay the historical price-revocation block because it returned “missing trie node”, so that specific replay is recorded as unverified.

- [Full on-chain settlement record](dist/pilot-v2-settlement.json)
- [Public bilingual evidence](https://fual-property-rwa.phamphuanloc.chatgpt.site/pilot.html#proof-v2)
- [V2 guide](docs/PILOT-V2.md)
- [V2 Solidity source](rehearsal/RehearsalV2.sol)
- [V2 interface](https://fual-property-rwa.phamphuanloc.chatgpt.site/pilot-v2)

These results cover one synthetic property and one rental period on testnet. Real property custody, legally recognized rights and production security review remain roadmap work.
