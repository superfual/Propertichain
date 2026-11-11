# Property RWA — Bản thiết kế khởi động v0.1

Ngày: 07/11/2026. Chủ ý tưởng: Phạm Phú An Lộc / Fual Nguyễn.
Tên làm việc, chưa chốt thương hiệu. Trạng thái: đặc tả chuẩn bị, chưa triển khai hợp đồng, chưa huy động vốn, chưa có đối tác ngân hàng hoặc bất động sản.

## 1. Mục tiêu và phạm vi đã chốt

Hạ tầng cho doanh nghiệp quản lý phần sở hữu của bất động sản hiện hữu và phân phối dòng tiền thực tế qua BNB Smart Chain. Mục tiêu dài hạn là quyền sở hữu thật được công nhận và có cơ chế đối chiếu pháp lý; token testnet chỉ mô phỏng quyền này.

Tài sản mục tiêu: căn hộ chung cư, nhà phố, đất vườn, homestay và farmstay đã hiện hữu, có thể kiểm chứng. Không huy động vốn để xây dựng dự án chưa tồn tại. Tài sản hiện hữu không đồng nghĩa đủ điều kiện đưa lên nền tảng hoặc chắc chắn có dòng tiền.

Không phát hành token quản trị/utility riêng của nền tảng; không bán token nền tảng, không unlock token đội ngũ. Doanh thu dự kiến từ phí triển khai, quản lý và vận hành dịch vụ, cần kiểm chứng với khách hàng doanh nghiệp.

## 2. Các nguyên tắc bất biến

1. Một bất động sản cụ thể có một propertyId chính thức, một token phần sở hữu và một quỹ phân phối riêng.
2. Token của hai căn khác nhau không thay thế nhau dù cùng tòa, tầng hay diện tích.
3. Tổng cung cố định trong demo: 1.000.000 phần/căn; 10.000 phần tương đương 1%. Phần chưa bán vẫn có chủ sở hữu được ghi nhận, không biến mất khỏi mẫu số.
4. Không được phát hành trùng cùng quyền sở hữu trong registry. Blockchain chỉ ngăn trùng trong hệ thống; việc thế chấp hoặc token hóa ngoài hệ thống cần xác minh hồ sơ ngoài đời.
5. Tiền thuê của căn A không được phân phối cho chủ căn B.
6. Giá trị tham chiếu và tiền thuê độc lập. Tài sản tăng giá không tự tăng tiền thuê.
7. Cập nhật trạng thái định giá mỗi ngày; không bịa giá mới nếu thiếu dữ liệu. Hiện ngày bằng chứng, nguồn, độ tin cậy và trạng thái stale/review.
8. Quyền nhận tiền đã tích lũy không mất khi bán hết token hoặc bị khóa chuyển nhượng.
9. Đóng băng chuyển nhượng, giữ khoản chi trả và dừng giao dịch là các quyền độc lập.
10. Không có chức năng một quản trị viên tự mint thêm, rút tiền thuê của người khác hoặc chuyển quyền sở hữu tùy ý.

## 3. Dữ liệu demo — hoàn toàn giả lập

| Thuộc tính | Căn A1201 | Căn A1202 |
|---|---:|---:|
| propertyId | DEMO-PROP-001 | DEMO-PROP-002 |
| Giá trị tài sản ban đầu | 5 tỷ VND | 4 tỷ VND |
| Tổng phần sở hữu | 1.000.000 | 1.000.000 |
| Giá tham chiếu/phần | 5.000 VND | 4.000 VND |
| Trạng thái thuê | Đang thuê | Đang trống |
| Tiền thuê kỳ 30 ngày | 15 triệu VND | 0 |
| Chi phí và dự phòng từ tiền thuê | 3 triệu VND | Không có tiền thuê để trừ |
| Phân phối cho kỳ | 12 triệu VND | 0 |

Chi phí căn trống lấy từ quỹ dự phòng riêng, hoặc cơ chế bổ sung được quy định trước. Không lấy quỹ căn khác. Mọi tên căn, định giá, giấy tờ và tiền đều phải gắn nhãn mô phỏng. Đơn vị tính VND trong sổ minh họa không phải token VND được bảo chứng. Không quy đổi USD thật trong bản đầu; yêu cầu mua từ 1–2 USD để giai đoạn sau khi có cơ chế tỷ giá và thanh toán.

## 4. Kiến trúc dự kiến

| Thành phần | Trách nhiệm |
|---|---|
| PropertyRegistry | Mã căn duy nhất, hồ sơ tham chiếu, trạng thái tài sản, địa chỉ token/quỹ |
| PropertyFactory | Tạo bộ token và quỹ, đăng ký liên kết đúng căn |
| PropertyShareToken | ERC-20 riêng mỗi căn, số dư, khóa theo lượng, quyền chuyển |
| RentalVault | Tiền thực nhận, quyết toán kỳ, quyền nhận và rút tiền theo từng căn |
| ValuationController | Đề xuất/duyệt định giá nhiều bên, nguồn và thời hạn dữ liệu |
| ControlledMarketplace | Khớp giao dịch được phép trong biên độ của phiên bản định giá |
| IncidentController | Phạm vi sự cố, lý do, đóng băng và mở khóa có kiểm soát |

Testnet dự kiến: BNB Smart Chain, chainId 97. Chưa triển khai hoặc xin chữ ký giao dịch trong bước này. Công nghệ và phiên bản thư viện phải được kiểm tra lại trước khi viết hợp đồng.

## 5. Tiền thuê và chuyển nhượng giữa kỳ

Demo tính quyền nhận bằng số phần nhân thời gian nắm giữ trong kỳ, tổng cung cố định. Hợp đồng chốt tích lũy của hai bên trước mỗi lần chuyển. Khi kỳ kết thúc, chỉ phân phối số tiền đã được cấp đủ vào quỹ và xác nhận chi phí.

allocation(u,k) = distributable(k) × shareSeconds(u,k) / (fixedSupply × periodSeconds(k)).

Ví dụ: 1% giữ 10/30 ngày nhận 40.000 đơn vị minh họa từ quỹ 12 triệu; người mua giữ 20/30 ngày nhận 80.000. Tất cả chủ sở hữu còn lại chia phần còn lại. Cần quy tắc làm tròn và phần dư lưu trong quỹ, không chia vượt nguồn tiền.

Mỗi kỳ có id duy nhất, thời gian bắt đầu/kết thúc, số thực thu, chi phí, số phân phối và trạng thái. Không được quyết toán hai lần. Khoản thuê trả chậm gắn lại đúng kỳ thuê; điều chỉnh sau quyết toán là kỳ điều chỉnh riêng có tham chiếu, không sửa âm thầm lịch sử. Bản demo không giải quyết thu hồi tiền đã rút sau tranh chấp.

## 6. Định giá và chống thao túng

Giá tham chiếu demo = giá trị căn / tổng số phần. Khi triển khai thật cần bổ sung cấu trúc tài sản ròng, nợ, quyền ưu tiên và tiền mặt để tránh đánh đồng giá nhà với giá trị vốn chủ sở hữu.

Quy trình: đề xuất giá và bằng chứng → kiểm tra dữ liệu → phê duyệt nhiều bên → công bố phiên bản có hiệu lực. Ngưỡng tăng bất thường đưa vào review, không tự phủ nhận giá thị trường thật. Tập đoàn không một mình duyệt giá của tài sản mình bán.

Biên độ ±5% chỉ là thông số thử nghiệm, chưa phải chính sách thương mại. Lệnh phải lưu phiên bản định giá và hạn dùng; hủy hoặc báo giá lại khi phiên bản thay đổi. Nguồn giá hết hạn thì không mở giao dịch mới. Không dùng giá khớp token làm đầu vào duy nhất cho định giá bất động sản.

Token chỉ chuyển qua đường giao dịch được phép. Cho phép tặng/chuyển ví cần luồng riêng có kiểm tra, vì chuyển trực tiếp có thể vượt qua kiểm soát giá. Giao dịch trả tiền ngoài hệ thống vẫn không thể bị loại bỏ hoàn toàn. Thiếu người mua thì lệnh không khớp; không cam kết mua lại.

## 7. Sự cố và phân quyền

Vai trò demo: đơn vị quản lý tài sản; người đề xuất giá; hội đồng duyệt; nhóm ứng cứu; chủ sở hữu. Phân quyền tối thiểu, không dùng một ví cho mọi vai trò trong sản phẩm thật.

- Nhóm ứng cứu được tạm dừng nhanh trong phạm vi cho phép; phải phát sự kiện với incidentId và mã lý do.
- Mở khóa hoặc khôi phục cần phê duyệt nhiều bên; mọi trường hợp có hạn rà soát và nhật ký.
- Khóa số token cụ thể: ngăn chuyển phần đó, vẫn tích lũy tiền thuê.
- Nghi ví bị hack: có thể giữ chi trả tại quỹ; không xóa quyền hưởng tiền.
- Khôi phục ví phải bảo toàn tổng cung và xử lý quyền nhận tiền của ví cũ, không tạo hai bản quyền sở hữu. Luồng này ở giai đoạn sau; demo đầu chỉ freeze/unfreeze, không cưỡng chế chuyển token.
- Tách pause thị trường khỏi pause rút tiền: tránh tự động chặn tiền của mọi chủ sở hữu khi chỉ có sự cố giá.

## 8. Kịch bản demo tối thiểu và tiêu chí nghiệm thu

| ID | Thử nghiệm | Kết quả bắt buộc |
|---|---|---|
| A01 | Đăng ký hai căn | Hai token/quỹ đúng liên kết; không đăng ký trùng id |
| A02 | Phát hành và chuyển phần sở hữu | Tổng cung luôn 1 triệu/căn; không mint trái quyền |
| A03 | Cấp quỹ thuê cho A, B trống | Chỉ chủ A có khoản nhận từ A |
| A04 | Bán 1% A sau 10/30 ngày | Người bán nhận 40.000; người mua 80.000 đơn vị demo |
| A05 | Giá A tăng từ 5 lên 6 tỷ | Giá tham chiếu thành 6.000; tiền thuê không đổi |
| A06 | Lệnh ngoài biên độ hoặc giá cũ | Bị từ chối; không thay đổi giá tham chiếu |
| A07 | Khóa một phần số dư | Chỉ phần chưa khóa được chuyển; quyền thuê được giữ |
| A08 | Pause căn A | Không vô tình pause căn B |
| A09 | Rút lặp và quyết toán trùng | Bị từ chối; tổng tiền rút không vượt quỹ |
| A10 | Người không có quyền sửa giá/mở khóa | Bị từ chối |
| A11 | Không có người mua | Lệnh chờ/hủy; không hứa thanh khoản |

Các bài kiểm tra tiền, phân quyền, khóa token và chuyển nhượng là bắt buộc trước testnet. Chưa tuyên bố đã kiểm toán hay đủ an toàn cho tài sản thật.

## 9. Phạm vi và trình tự thực hiện

Đã thực hiện trong bước khởi động: tổng hợp quyết định, mô hình dữ liệu, kiến trúc dự kiến, bộ tình huống nghiệm thu và ranh giới demo.

Tiếp theo:
1. Xác nhận với ban tổ chức quy định chuẩn bị trước, code cũ và build trong 36 giờ. Chưa mặc định rằng được xây toàn bộ bài thi trước sự kiện.
2. Hoàn thiện wireframe ba góc nhìn: người mua, đơn vị quản lý, người kiểm soát/sự cố; chốt thuật ngữ và nhãn mô phỏng.
3. Sau khi rõ quy định, dựng hợp đồng và test các tiêu chí A01–A11, triển khai testnet và lưu giao dịch kiểm chứng.
4. Nối giao diện vào hợp đồng, quay demo ngắn và mở mã nguồn phù hợp quy định.
5. Phỏng vấn doanh nghiệp để xác thực nhu cầu và mức phí; không tuyên bố có đối tác khi chưa có.

Ngoài MVP: vốn vay ngân hàng, cưỡng chế khôi phục ví, bán cả căn, thuế, đối soát ngân hàng thật, thanh toán thật, homestay/farmstay nhiều loại doanh thu. Những phần này vẫn thuộc lộ trình, không bị loại bỏ khỏi tầm nhìn.

## 10. Nguồn và câu hỏi còn mở

- Thông báo cuộc thi đã đọc trong phiên nghiên cứu trước: https://www.bnbchain.org/en/blog/bnb-bangkok-build-demo-and-pitch
- Trang đăng ký: https://luma.com/n5y1y7cu
- Quyền sở hữu trực tiếp theo mô hình pháp lý nào; ai xác nhận và ai bảo vệ chủ sở hữu khi doanh nghiệp ngừng hoạt động?
- Ai cung cấp dữ liệu định giá có thể kiểm chứng, chi phí bao nhiêu, cập nhật với độ tin cậy nào?
- Ai trả phí dịch vụ và có thể vận hành bền vững ở mức vốn đầu tư nhỏ đến đâu?
- Cơ chế thanh khoản và thoái vốn khi không có người mua?

Tài liệu là đặc tả sản phẩm đề xuất, không phải kết luận pháp lý, báo cáo kiểm toán hoặc bằng chứng quyền sở hữu thật.
