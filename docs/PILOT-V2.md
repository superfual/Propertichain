# Chuẩn bị lượt BSC Testnet V2

Trạng thái: hợp đồng V2 và bộ kiểm tra local đã chuẩn bị. Chưa triển khai V2 trên BSC Testnet. Giao diện pilot đang công khai vẫn chạy hợp đồng V1. Cần nối giao diện V2 và kiểm tra kết nối ví thực tế trước khi hướng dẫn người dùng giao dịch.

## Mục tiêu

Một căn giả lập, 1.000 phần và một kỳ thuê. Ví A phát hành, chuyển 400 phần cho ví B. Người vận hành chủ động đóng kỳ sau khi hoàn thành bước chuyển, rồi cấp quỹ và để từng ví nhận phần thuê được hưởng.

Thời gian thực tế giữa các giao dịch vẫn được blockchain ghi lại. Việc chủ động đóng kỳ bỏ hạn chót cố định của bản demo. Người vận hành có quyền quyết định thời điểm đóng, nên cơ chế này cần quy trình phê duyệt phù hợp trước khi phát triển thành sản phẩm thật.

## Các bước chuẩn bị cho giao diện V2

1. Đọc chain 97, mã hợp đồng và trạng thái qua RPC mà không bắt buộc giữ kết nối ví.
2. Kết nối ví A để triển khai hợp đồng V2 từ pilot-v2-plan.json. Giá trị gửi là 0, phí gas được ước tính trước khi ký. Gas local đo được 852.076, gas thực tế và giới hạn ví phải kiểm tra riêng.
3. Lưu địa chỉ hợp đồng, mã giao dịch, ví A và ví B để tải lại trang vẫn đọc được tiến độ. Xác nhận receipt thành công và bytecode trước khi chuyển bước.
4. Ghi digest hồ sơ giá và phát hành 1.000 phần cho A.
5. Chuyển 400 phần cho B. Có thể làm ngay sau khi phát hành, không cần canh giữa kỳ.
6. Đọc lại sau khi đóng/mở trang, kết nối lại A và B để kiểm chứng hành vi ví thực tế.
7. Kiểm tra quyền, thu hồi hồ sơ giá, tạm dừng và khôi phục. Dùng eth_call cho các thao tác dự kiến bị chặn để tránh tốn gas cho giao dịch lỗi.
8. A chủ động đóng kỳ bằng closePeriod. Nếu timestamp chưa lớn hơn thời điểm phát hành, thử lại ở block sau.
9. Cấp tổng cộng 6.000.000 wei tBNB vào quỹ. Mỗi ví nhận theo quyền tích lũy. Chỉ hiển thị thành công sau receipt.
10. Đọc claimable và claimed, mô phỏng nhận trùng ở cả hai ví, lưu hash và kết quả kiểm tra công khai.

## Quy tắc phân tiền

Tiền thuê = quỹ × tổng (số phần × thời gian nắm giữ) / (1.000 × độ dài kỳ).

Ví dụ local chuyển sau 50 giây, đóng sau 100 giây: A nhận 4.800.000 wei, B nhận 1.200.000 wei. Tỷ lệ trong lượt testnet sẽ phụ thuộc timestamp thực tế. Ví đã chuyển hết phần vẫn có quyền nhận tiền thuê đã tích lũy trước đó.

Số tiền được làm tròn xuống theo wei. Có thể còn số dư nhỏ trong quỹ ở các cách chia khác. Hợp đồng thử nghiệm chưa có cơ chế quyết toán số dư này.

## Chạy kiểm tra

Trong rehearsal/:

```sh
npm ci --ignore-scripts --force --no-audit --no-fund
node build-v2.mjs --write
node run-v2.mjs --write
```

Lockfile Ganache hiện có fsevents dành cho macOS nên npm ci trên Linux cần --force trong môi trường thử này. Không dùng khóa ví thật cho bộ kiểm tra. Ganache tạo các tài khoản local tạm thời.

Kết quả local ở dist/pilot-v2-local-result.json. Việc tạo lại provider và signer local đã thành công. Điều này chưa xác nhận Binance Wallet/Trust Wallet trên điện thoại kết nối lại thành công. Kiểm thử đó phải được thực hiện qua giao diện V2 trước khi coi lượt pilot hoàn tất.

Hợp đồng có một tài sản giả lập và một kỳ. Đây là nguyên mẫu thử chức năng, chưa qua audit. Cơ chế dừng có thể khóa tạm thời cả nhận thuê. Hợp đồng V1 và bằng chứng đã công bố được giữ trong lịch sử dự án.
