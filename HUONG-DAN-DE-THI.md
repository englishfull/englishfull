# Hướng dẫn thêm đề THCS/THPT và IELTS vào EnglishFull

Tài liệu này hướng dẫn nhập đề bằng Google Sheets, triển khai Apps Script và cập nhật website. Các tệp mẫu nằm cùng thư mục với tài liệu này.

## 1. Các tệp vừa bổ sung

- `exam-catalog.html`: danh mục đề THCS/THPT hoặc IELTS.
- `exam-session.html`: trang làm đề có đồng hồ, chuyển phần, điều hướng câu và lưu tạm bài đang làm trên trình duyệt.
- `Code.gs`: Apps Script đọc danh mục/ngân hàng đề và nhận kết quả.
- `exam-catalog-template.csv`: mẫu danh mục đề.
- `exam-questions-template.csv`: mẫu dữ liệu câu hỏi.
- `exercises.html`: có hai liên kết mới trong mục “Các kỹ năng khác”.
- `history.html`, `admin.html`, `review.js`: hiển thị tên đề và xem lại câu sai.

## 2. Tạo danh mục đề trong Google Sheets

1. Mở Google Sheets danh mục hiện dùng cho website. ID của tệp này đã được khai báo ở biến `SHEET_ID` đầu `Code.gs`. Đây là tệp chứa danh sách chuyên đề hiện có; **không** dùng tệp trung tâm `HUB_ID` để tạo danh mục đề.
2. Tạo một tab mới, đặt tên chính xác là `ExamCatalog`.
3. Mở `exam-catalog-template.csv`, sao chép dòng tiêu đề vào dòng 1 của tab `ExamCatalog`. Tạo mỗi đề thi thành một dòng riêng.
4. Điền các cột như sau:

| Cột | Nội dung | Ví dụ |
| --- | --- | --- |
| A `ID` | Mã đề duy nhất, chỉ nên dùng chữ, số, `_` hoặc `-` | `THCS9_GHK1_01` |
| B `Track` | Phân loại đúng một trong hai giá trị | `school` hoặc `ielts` |
| C `Group` | Nhãn dùng để lọc trên trang danh mục | `THCS · Lớp 9 · Giữa kì I` |
| D `Title` | Tên hiển thị của đề | `Đề giữa kì I – Mã đề 01` |
| E `Description` | Mô tả ngắn | `45 phút · 40 câu` |
| F `BankSpreadsheetID` | ID Google Sheets chứa câu hỏi | ID nằm giữa `/d/` và `/edit` trong URL |
| G `DurationMin` | Thời gian làm bài, tính bằng phút | `45` |
| H `Active` | `TRUE` để hiện đề; `FALSE` để ẩn | `TRUE` |
| I `BankTab` | Tên tab chứa câu hỏi cho đề này | `THCS9_GHK1_01` |

**Có thể để nhiều đề trong cùng một Google Sheets ngân hàng.** Mỗi đề dùng một tab riêng, và tên tab phải khớp chính xác với cột `BankTab`. Nếu chỉ có một đề, có thể đặt tên tab `ExamQuestions`. Tài khoản Google sở hữu/triển khai Apps Script phải có quyền xem tệp ngân hàng; học sinh không cần được chia sẻ trực tiếp tệp này.

### Nhóm đề nên đặt thống nhất

Trang danh mục lọc theo đúng nội dung cột `Group`, vì vậy hãy dùng cùng cách viết cho các đề cùng nhóm. Gợi ý:

- THCS: `THCS · Lớp 6 · Giữa kì I`, `THCS · Lớp 9 · Cuối kì II`, `THCS · Lớp 9 · Ôn thi vào 10`.
- THPT: `THPT · Lớp 10 · Giữa kì I`, `THPT · Lớp 11 · Cuối kì II`, `THPT · Lớp 12 · Ôn thi tốt nghiệp`.
- IELTS: `IELTS · Listening`, `IELTS · Reading`, `IELTS · Writing`, `IELTS · Speaking`, `IELTS · Full mock test`.

Trên trang học sinh, THCS/THPT tự tách thành bộ lọc **Cấp/lớp** và **Kỳ/dạng đề**; IELTS có bộ lọc **Kỹ năng/dạng đề**. Hãy ngăn các phần trong `Group` bằng dấu `·` như ví dụ để bộ lọc tách đúng. Học sinh vẫn có thể tìm theo từ khóa như “lớp 9” hoặc “giữa kì I”.

## 3. Nhập câu hỏi vào tab ngân hàng đề

1. Trong Google Sheets ngân hàng, tạo tab có tên đã ghi ở cột `BankTab`. Không gộp ô; hàng 1 là tiêu đề và dữ liệu bắt đầu từ hàng 2.
2. Sao chép dòng tiêu đề của `exam-questions-template.csv` vào dòng 1.
3. Mỗi câu hỏi hoặc nhiệm vụ thi chiếm một dòng. Các cột là:

| Cột | Nội dung | Cách điền |
| --- | --- | --- |
| A `Section` | Phần lớn của đề | `Listening`, `Reading`, `Writing`, `Speaking` hoặc `Phần trắc nghiệm` |
| B `Part` | Phần nhỏ | `Part 1`, `Task 2`, `Câu 1–10` |
| C `Type` | Loại câu | `mc`, `tfng`, `ynng`, `short`, `essay`, `writing`, `speaking` |
| D `Stimulus` | Đoạn văn, chỉ dẫn hoặc nội dung chung | Có thể lặp lại cùng đoạn văn ở các câu liên quan |
| E `Question` | Nội dung câu hỏi/nhiệm vụ | Một câu hỏi cho mỗi hàng |
| F `Options` | Các lựa chọn trắc nghiệm | `A. ... \| B. ... \| C. ... \| D. ...` |
| G `CorrectAnswer` | Đáp án chuẩn | Trắc nghiệm ghi `A`; True/False ghi `True`; câu điền ghi đáp án |
| H `Explanation` | Giải thích đáp án | Hiện khi xem lại câu sai |
| I `Topic` | Chủ điểm hoặc kỹ năng | Ví dụ `Reading detail`, `Mệnh đề quan hệ` |
| J `MediaURL` | Đường dẫn audio/tài liệu | Đường dẫn HTTPS; MP3/M4A/OGG/WAV có trình phát trên trang |
| K `QuestionID` | Mã câu duy nhất trong đề, không trùng trong cùng đề | Ví dụ `Q1`, `LISTEN_01` |

### Quy tắc nhập đáp án

- Với `mc`, mỗi option cần có nhãn `A.`, `B.`, `C.`, `D.`; `CorrectAnswer` chỉ ghi chữ cái, ví dụ `B`.
- Với `tfng`, đáp án chuẩn là `True`, `False` hoặc `Not Given`.
- Với `ynng`, đáp án chuẩn là `Yes`, `No` hoặc `Not Given`.
- Với `short`, nhập đáp án mong đợi vào `CorrectAnswer`. Chấp nhận nhiều đáp án bằng cách ngăn bằng dấu `|`, ví dụ `colour | color`.
- Với Writing/Speaking, dùng `essay`, `writing` hoặc `speaking`; để trống `CorrectAnswer`. Hệ thống không tự chấm phần này.
- Nếu đề có nội dung dùng chung, chép cùng `Stimulus` vào các hàng tương ứng để đoạn đó luôn hiện cạnh câu hỏi.
- Dùng URL audio HTTPS có quyền truy cập phù hợp. Đường dẫn trực tiếp đến tệp âm thanh sẽ hiện nút phát trong trang.

## 4. Triển khai Apps Script

1. Mở đúng dự án Apps Script đang được website gọi. Trong `Code.gs`, địa chỉ triển khai hiện được dùng bởi `BASE` trong các trang HTML.
2. Sao lưu mã đang chạy trước khi thay đổi.
3. Cập nhật mã theo `Code.gs` trong thư mục website. Nếu dự án có nhiều tệp `.gs`, bảo đảm chỉ còn **một** hàm `doGet` và **một** hàm `doPost`; tránh để bản cũ trùng tên.
4. Lưu mã. Trong editor, chọn hàm `authorizeAll` và chạy một lần; đăng nhập đúng tài khoản triển khai và cấp quyền nếu Google yêu cầu. Tài khoản đó cần có quyền xem các tệp ngân hàng đề.
5. Chọn **Deploy → Manage deployments**. Mở deployment Web app hiện tại, bấm biểu tượng chỉnh sửa, chọn phiên bản mới nhất rồi **Deploy**. Giữ deployment hiện tại để URL `/exec` không đổi; một version mới cập nhật mã mà vẫn giữ URL deployment.
6. Cấu hình Web app chạy dưới tài khoản chủ sở hữu/triển khai (**Execute as me**) và cho phép truy cập cả người chưa đăng nhập Google (chế độ anonymous/`ANYONE_ANONYMOUS`). Nếu tùy chọn chỉ yêu cầu người dùng có tài khoản Google đăng nhập thì học sinh chưa đăng nhập sẽ không tải được danh mục đề. Trang vẫn xác thực token riêng trước khi lưu lịch sử.

Nếu bạn tạo deployment mới với URL `/exec` khác, thay URL `BASE`/`AUTH_API` trong các trang hiện dùng Apps Script bằng URL mới, rồi cập nhật toàn bộ website.

## 5. Đưa trang mới lên website

Trong thư mục website, giữ các tệp `exam-catalog.html` và `exam-session.html` ở cùng cấp với `exercises.html`, `test.html`, `favicon.svg` và `history.html`. Đưa các trang HTML, `review.js`, `sitemap.xml` và tài nguyên cần cho website lên GitHub repository đang xuất bản GitHub Pages, sau đó chờ Pages cập nhật. `Code.gs` được triển khai riêng trong Apps Script; không đưa tệp này lên repository GitHub Pages công khai. Tệp `.gitignore` đã được thêm để tránh đưa nhầm `Code.gs` vào lần đồng bộ sau.

Hai mục mới đã được gắn ở `exercises.html` → “Các kỹ năng khác”. `sitemap.xml` cũng có đường dẫn cho hai danh mục.

## 6. Luồng sử dụng

1. Học sinh mở **Bài tập** rồi chọn **Đề thi THCS&THPT** hoặc **IELTS**.
2. Chọn nhóm, mở đề và nhấn **Bắt đầu làm bài**.
3. Hệ thống chạy đồng hồ; câu trả lời được lưu tạm trên trình duyệt này để có thể khôi phục nếu tải lại trang trong vòng 24 giờ.
4. Khi nộp, câu có đáp án chuẩn được chấm tự động và hiển thị lời giải cho câu sai.
5. Học sinh có thể làm bài khi chưa đăng nhập; bài làm dở chỉ được lưu tạm trong trình duyệt đó. Muốn ghi lượt làm vào lịch sử cần đăng nhập Google trước khi nộp. Lượt chỉ có tự luận được lưu ở trạng thái **Chờ chấm**; nếu đề có cả câu trắc nghiệm và tự luận thì lịch sử ghi điểm phần có đáp án chuẩn và báo còn phần tự luận cần chấm. Writing/Speaking không được tính điểm tự động.

## 7. Cách kiểm tra sau khi triển khai

- Mở `exercises.html`, kiểm tra hai liên kết mới.
- Thêm một dòng thử trong `ExamCatalog` với `Active=TRUE`; kiểm tra đề xuất hiện đúng danh mục.
- Mở đề, kiểm tra thời gian, nhóm phần, câu hỏi, audio và điều hướng.
- Thử một câu trắc nghiệm đúng/sai, rồi nộp; kiểm tra giải thích và đường dẫn lịch sử.
- Đăng nhập Google trước khi làm lượt cần lưu. Sau khi nộp, kiểm tra tab `Results` trong spreadsheet trung tâm: cột I lưu đáp án học sinh, cột J báo trạng thái chờ chấm. Sau đó kiểm tra trang `history.html`.

Khi xem thống kê, các lượt chỉ có tự luận vẫn được tính vào số lần làm nhưng không tính thành 0 điểm trong điểm trung bình. Điểm hiển thị của đề có cả trắc nghiệm và tự luận chỉ là điểm phần chấm tự động. Với học sinh đã đăng nhập, câu trả lời được lưu ở tab `Results`, cột I (`Đáp án đã chọn`, dữ liệu JSON theo `QuestionID`); cột J (`Tự luận`) ghi `Chờ chấm` nếu đề có câu cần chấm thủ công. Hiện trang web đánh dấu lượt chờ chấm nhưng chưa có màn hình nhập điểm tự luận; giáo viên xem nội dung trả lời trong Google Sheets.

Nếu danh sách trống, kiểm tra tên tab `ExamCatalog`, cột `Track`, `Active` và quyền truy cập spreadsheet. Nếu báo không tìm thấy ngân hàng, kiểm tra `BankSpreadsheetID`, quyền xem của tài khoản Apps Script và `BankTab`.
