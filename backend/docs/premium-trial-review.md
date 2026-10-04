# HANFLIX — Review & QA Premium Trial 15 ngày

Ngày kiểm tra: 04/10/2026 (Asia/Saigon). Đã đọc cả prompt triển khai mới và prompt REVIEW + QA được gửi lại. Bản REVIEW gửi lại trùng nội dung bản ban đầu; prompt triển khai xác nhận first-login 15 ngày là nghiệp vụ cuối cùng.

## 1. Overall status

**FAIL đối với điều kiện nghiệm thu toàn bộ checklist; nghiệp vụ trong phạm vi kiểm tra đã được sửa và đạt các kiểm tra tự động.** Không còn lỗi Critical/High đã biết chưa sửa trong phạm vi audit. Chưa thể đánh dấu “Lint pass” vì cả hai workspace chưa cấu hình lint. Format check còn lỗi nền. Chưa xác nhận giao dịch merchant payOS thật hoặc rollout production; không báo hoàn tất production.

Không redesign thêm, không đổi business rule, không commit/deploy, không chạy migration trên dữ liệu production.

## 2. Business flow validation

| Flow | Kết quả / bằng chứng |
|---|---|
| A: Register → first authenticated login → Trial → popup → Premium | PASS: MongoDB test register/credential/login + browser login/popup. Google tạo account và đăng nhập cùng lần được coi là first login. |
| B: Logout/login/device/cache | PASS: ngày Trial giữ nguyên; seen idempotent theo user; browser reload sau xóa localStorage không hiện lại. |
| C: Trial hết → Free, vẫn đăng nhập, không mất dữ liệu | PASS: T−1ms được phép, T bị chặn; lifetime record giữ lại, không ghi downgrade/xóa. Snapshot profile/progress/words/streak giữ nguyên. |
| D: Hết Trial rồi mua → paid từ thời điểm xác minh | PASS trên MongoDB với provider mô phỏng. |
| E: Mua trong Trial → paid nối sau Trial | PASS; hai lần mua sớm vẫn giữ ngày bắt đầu paid đầu tiên và cộng đủ tháng. |
| F: Old user | PASS: login, /me, chọn gói không tạo Trial. |
| G: Login đồng thời | PASS: 8 request login cùng lúc trả cùng ngày Trial đã lưu. Race grant/Trial không mất thời gian đã mua. |

## 3. Critical issues found

- API `/billing/subscribe` vẫn có nhánh Trial từ chọn plan, không dùng rollout/feature flag. Đã xóa nhánh này ở backend, contract, hook và modal frontend. Không còn khả năng old user nhận Trial qua pricing.
- Cấu hình tự bật và tự thay timestamp không hợp lệ bằng ngày mặc định có thể cấp Trial cho account không thuộc rollout thật. Đã chuyển sang disabled mặc định; bật mà thiếu cutoff sẽ fail startup; ngày sai bị từ chối.

## 4. High issues found

- Login thắng race tự dựng startedAt mới; login thua có thể trả state Free cũ. Đã đọc lại dữ liệu persisted sau atomic update.
- `/me` tự kích hoạt Trial, có thể cấp cho phiên đã đăng nhập từ trước. Đã chuyển `/me` thành chỉ đọc; chỉ password/Google login kích hoạt sau xác thực và tạo session.
- Gia hạn ghi đè premiumStartedAt bằng ngày bắt đầu phần nối thêm. Đã giữ mốc bắt đầu của giai đoạn paid liên tục; thêm test hai lần mua trong Trial.
- Frontend 403 không refresh subscription; đã bổ sung sự kiện refresh và khóa nội dung ngay, không xóa token. Có timer deadline và refresh focus/online.
- Popup nuốt lỗi mark-seen rồi đóng, có thể hiện lại lần sau. Đã yêu cầu lưu thành công trước khi đóng và cho retry nếu lỗi; chặn double-click.
- Subscribe bỏ mất kiểm tra giá đang hiển thị. Đã giữ expectedPrice như điều kiện so sánh với giá server, không phải override; giá khác trả PLAN_PRICE_CHANGED trước tạo order.
- Checkout có sẵn fallback số tài khoản/QR người nhận hardcode. Đã loại bỏ; chỉ dùng dữ liệu payment trả về và link payOS. Đây là lỗi tìm được khi audit payment, không phải do Trial tạo ra.

## 5. Medium issues found

- Copy 30 ngày còn trong FreeFeed, modal Trial cũ, catalog và script. Đã dọn đúng nội dung Trial; giữ “30 ngày” thuộc streak/lịch sử học.
- Thiếu focus trap/restore, reduced motion và lỗi scroll màn hình thấp. Đã sửa; kiểm tra 360×640, 390×844, 768×1024, 1366×768.
- Thiếu thông báo paid scheduled và popup dùng effective paid expiry thay vì trial.endsAt. Đã tách đúng ngày, hiển thị gói sẽ bắt đầu sau Trial.
- 19 bản dịch giao diện mới chưa có. Đã bổ sung; check:i18n = 0 missing.

## 6. Low issues found

Bỏ unsafe any/nhánh giả lập query khỏi subscription service; dùng kiểu dữ liệu rõ ràng. Bỏ index boolean hasUsedTrial không phục vụ query thực tế. Bỏ TrialSuccessModal không còn dùng. File mới frontend được format; không format lại toàn bộ module ngoài phạm vi.

## 7. Files fixed/reviewed

Risk trong bảng là độ nhạy của vùng thay đổi, không phải lỗi còn tồn tại. Diff UI có sẵn gồm FreeFeed, locked preview, Header và pricing; giữ bố cục hiện tại và chỉ sửa hành vi/copy/accessibility. Các file grammar/watch hiển thị modified trong status nhưng không có diff nội dung ở thời điểm đối chiếu; không hoàn tác thay đổi của người dùng.

| File | Change | Purpose | Risk |
|---|---|---|---|
| `.github/workflows/ci-backend.yml` | Thêm job MongoDB lifecycle trước build | Kiểm tra race/payment trên CI | Trung bình |
| `backend/.env.example` | Bổ sung cấu hình rollout tắt mặc định | Triển khai có cutoff rõ ràng | Cao |
| `backend/docs/premium-trial.md` | Thay tài liệu cũ bằng first-login 15 ngày | Hướng dẫn rollout và kiểm chứng | Thấp |
| `backend/scripts/migrate-premium-history.ts` | Entrypoint migration mặc định dry-run | Không tự ghi production | Cao |
| `backend/src/app.ts` | Giữ alias /user của auth router | Tương thích endpoint đã thêm | Trung bình |
| `backend/src/config/env.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/config/env.ts` | Validate boolean, đúng 15 ngày, timestamp có múi giờ | Không cấp Trial do cấu hình ngầm/sai | Cao |
| `backend/src/middleware/auth.ts` | Nạp trial và ngày bắt đầu paid vào auth | Guard có đủ dữ liệu quyền | Cao |
| `backend/src/middleware/premium.ts` | Dùng entitlement chung; TRIAL_EXPIRED | Chặn đúng hạn | Cao |
| `backend/src/models/payment-order.model.ts` | Index userId/status | Lookup lịch sử trả phí | Trung bình |
| `backend/src/models/user.model.ts` | Thêm lịch sử Trial, seen, paid; bỏ index boolean thừa | Dữ liệu additive | Cao |
| `backend/src/routes/auth-google.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/routes/auth.routes.ts` | Kích hoạt sau xác thực/session; đọc lại kết quả atomic; /me chỉ đọc | First-login đúng và không stale khi race | Cao |
| `backend/src/routes/billing.routes.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/routes/billing.routes.ts` | Subscribe chỉ checkout, so sánh expectedPrice; API subscription/seen | Giữ payOS và chống giá cũ | Cao |
| `backend/src/services/admin-premium.ts` | Dùng cùng quy tắc nối hạn và giữ paid start | Admin không mất ngày Trial | Cao |
| `backend/src/services/billing.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/services/billing.ts` | Truyền planCode khi grant; log lifecycle | Giữ reconciliation payOS | Cao |
| `backend/src/services/premium-access.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/services/premium-access.ts` | Policy chung, boundary, scheduled start, giữ paid start khi gia hạn | Không hở quyền/mất thời gian đã mua | Cao |
| `backend/src/services/premium-history-migration.ts` | Backfill cờ lịch sử, dry-run, không ghi expiry | Tương thích lịch sử | Cao |
| `backend/src/services/premium.ts` | CAS receipt + expiry, append sau Trial | Thanh toán replay-safe | Cao |
| `backend/src/services/subscription.integration.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/services/subscription.ts` | Xóa trial từ pricing, bỏ any/history query mỗi request | Nguồn trạng thái thống nhất | Cao |
| `backend/src/services/trial.service.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `backend/src/services/trial.service.ts` | Eligibility, atomic update, seen idempotent | Một Trial trong vòng đời | Cao |
| `backend/src/types/express.d.ts` | Kiểu auth có Trial/paidStartedAt | Type safety | Thấp |
| `backend/src/utils/user.mapper.ts` | Map deadline hiệu lực; dùng policy chung | Public user nhất quán subscription | Trung bình |
| `backend/vitest.config.ts` | Env rollout rõ ràng trong test | Test độc lập .env cá nhân | Thấp |
| `frontend/e2e/billing-flow.spec.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/e2e/premium-trial.spec.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/scripts/update-translations.mjs` | Sửa nội dung Trial cũ trong script | Không tái sinh copy 30 ngày | Thấp |
| `frontend/src/App.tsx` | Sync subscription/403/deadline; popup theo account và trial.endsAt | Không stale, không logout, đúng popup | Cao |
| `frontend/src/api/__tests__/client.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/api/auth.ts` | Đọc typed subscription/UI từ login và restore | Không suy đoán Trial bằng cache | Trung bình |
| `frontend/src/api/billing.ts` | Contract checkout-only và paid scheduled | Không có TRIAL_STARTED từ plan | Cao |
| `frontend/src/api/client.ts` | Sự kiện entitlement-denied cho GET/mutation; giữ auth | 403 cập nhật quyền | Cao |
| `frontend/src/components/AIAssistantDrawer.tsx` | Giữ paywall/close hiện có trong diff | AI bị giới hạn theo guard | Trung bình |
| `frontend/src/components/ConnectedLearner.tsx` | Giữ FreeFeed hiện có trong diff | Trải nghiệm Free sau expiry | Trung bình |
| `frontend/src/components/FreeFeedView.tsx` | Bỏ quảng cáo Trial từ plan cũ | Không hứa sai ưu đãi | Trung bình |
| `frontend/src/components/Header.tsx` | Badge Trial/Premium; điều kiện query dashboard | Navbar đúng entitlement | Trung bình |
| `frontend/src/components/Sidebar.tsx` | Không query dashboard Premium khi Free | Giảm request bị từ chối | Thấp |
| `frontend/src/components/premium/LockedFeaturePreview.tsx` | Giữ paywall hiện có; định dạng file mới | Không redesign thêm | Thấp |
| `frontend/src/components/premium/PayOSCheckoutModal.tsx` | Bỏ trial branch và bank/QR fallback hardcode | Không gửi tiền tới thông tin tự suy ra | Cao |
| `frontend/src/components/premium/PremiumAccess.test.tsx` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/components/premium/PremiumAccess.tsx` | Guard deadline/server denial; paywall | Khóa nội dung khi mất quyền | Cao |
| `frontend/src/components/premium/PremiumPricingPage.tsx` | CTA paid; bỏ modal Trial cũ; giữ UI hiện tại | Không Trial từ plan | Trung bình |
| `frontend/src/components/premium/TrialStatusBanner.tsx` | Trial deadline/remaining và paid scheduled | Hiển thị bảo lưu thời gian | Trung bình |
| `frontend/src/components/premium/WelcomeTrialModal.tsx` | Seen lưu thành công trước đóng; retry; focus; reduced motion; mobile scroll | Một lần theo backend, accessibility | Trung bình |
| `frontend/src/components/premium/__tests__/premium-trial-flow.test.tsx` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/components/premium/__tests__/subscriptionState.test.ts` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/components/premium/billing-flow.test.tsx` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/components/premium/subscriptionState.ts` | Selector backend, expiry và status fallback | Badge không stale vô hạn | Trung bình |
| `frontend/src/data/hanflixData.ts` | Kiểu state và trialEndsAt riêng | Không dùng paid deadline làm Trial date | Thấp |
| `frontend/src/hooks/__tests__/usePaymentOrder.test.tsx` | Bổ sung/cập nhật regression theo nghiệp vụ mới | Xác minh hành vi thực tế và chống tái phát | Thấp |
| `frontend/src/hooks/usePaymentOrder.ts` | Bỏ trial branch; gửi expectedPrice; polling verified order | Không kích hoạt bằng URL | Cao |
| `frontend/src/i18n/messages.json` | Bỏ Trial 30 ngày; thêm 19 bản dịch còn thiếu và copy scheduled/error | Copy VN/EN/ZH nhất quán | Thấp |

## 8. Database/migration review

Mongoose User mở rộng additive, không tạo nguồn trạng thái duplicate. Trial là lifetime record, trạng thái FREE/TRIAL/ACTIVE/EXPIRED được derive theo ngày. Không có TTL xóa account hoặc cron quyết định quyền. Migration history mặc định dry-run, chỉ set hasEverPurchasedPremium; chạy lại an toàn. Đã test bảo toàn expiry và dữ liệu. Chưa áp dụng production. Các unique index orderCode và userId/idempotencyKey được giữ; userId/status phục vụ lookup lịch sử. CAS theo _id dùng index có sẵn.

## 9. Auth/first login review

Register whitelist dữ liệu account và vẫn yêu cầu verify email theo flow cũ. Wrong password, email chưa verified, locked/admin/old/used-trial/active-paid không được cấp. Session được tạo trước bước Trial. Login hợp lệ gọi ensureFirstLoginTrial và đọc persisted winner. /me trả cùng subscription và public-user deadline. GET không cấp Trial.

## 10. Trial entitlement review

premium-access là policy chung cho guards và mapper. Trial đúng 1.296.000.000ms, UTC. Paid và Trial đều kiểm tra ngày bắt đầu/kết thúc; scheduled paid không tự cho quyền trước start nếu không có Trial đang chạy. Expiry là kiểm tra runtime, không phụ thuộc cron và không sửa/xóa dữ liệu. EXPIRED có tier=free. Matrix 17 Premium read endpoints chặn expired Trial; grammar/vocabulary mở đúng guard khi Trial còn hạn. HSK/sample restrictions cũ vẫn giữ.

## 11. Popup review

Chỉ render theo backend showWelcomeTrialPopup. POST seen dùng userId từ auth, update có điều kiện và idempotent. Dismiss/CTA lưu trước đóng; lỗi lưu có retry. Popup giữ focus, hỗ trợ Tab/Shift+Tab/Escape, restore focus/body scroll; confetti dừng 1,3 giây và cleanup, reduced motion tắt. Đồng thời mở hai thiết bị trước khi một bên dismiss vẫn có thể cùng thấy popup; theo contract, trạng thái một lần được lưu khi dismiss, không phải atomic claim lúc render.

## 12. Premium pricing review

Không có thao tác kích hoạt Trial từ pricing. CTA upgrade/renew tạo paid order. Trial banner thể hiện ngày kết thúc và thời gian còn lại; paid scheduled hiển thị đúng mốc kế tiếp. Free account không còn được mời Trial 30 ngày.

## 13. payOS review

Giữ SDK, webhook verification và server reconciliation. Signature sai bị từ chối; amount/orderCode/paymentLinkId/currency đối chiếu. User và plan lấy từ order snapshot đã lưu, không tin client/webhook tự map. Chỉ trạng thái PAID đã xác minh mới grant. Return URL không kích hoạt. Replay webhook dùng receipt idempotent. Browser tests chứng minh status=PAID trên URL vẫn không làm thanh toán thành công khi backend còn PENDING. Provider trong test được mô phỏng; chưa chuyển tiền thật.

## 14. Security review

Không có entitlement field client-controlled được đưa vào register hoặc profile update. Subscribe strict DTO và giá do server quyết định, expectedPrice chỉ là điều kiện so sánh. Auth/ownedOrder ngăn userId spoof/IDOR. Token được giữ trên 403. Không tìm thấy secret literal mới trong diff qua scan có mục tiêu. Đây là code/QA review, không phải pentest hạ tầng production.

## 15. Race condition review

Trial: một atomic conditional User update với cutoff, lifetime flag, current entitlement và verification. Payment/admin: receipt và entitlement cập nhật cùng User document, CAS theo expiry + trial expiry, retry khi race. PaymentOrder có thể cập nhật sau User; crash giữa hai bước được replay bằng receipt, không cấp thêm lần nữa. Đã thử concurrent logins, duplicate webhook, concurrent paid/admin và Trial/paid.

## 16. Payment during Trial review

Start phần mua thêm = max(now, trial end, paid end hiện có). Add calendar months bằng helper UTC có clamp cuối tháng. premiumStartedAt của giai đoạn paid hiện có được giữ. Ví dụ yêu cầu 10/10 mua trong Trial kết thúc 19/10 → paid 19/10–19/11. Mua sau hết Trial bắt đầu tại thời điểm grant. Không mất ngày Trial, không downgrade khi mốc Trial cũ đi qua.

## 17. Old user rollout review

Eligibility bắt buộc createdAt >= cutoff; không backfill Trial cho user cũ. PREMIUM_TRIAL_ENABLED thiếu → false. Enabled=true nhưng thiếu cutoff → startup validation error. PREMIUM_TRIAL_DAYS khác 15 hoặc timestamp không timezone/sai → reject. Đã ghi ví dụ cấu hình trong .env.example và tài liệu, không tự chọn cutoff production hoặc sửa secret môi trường.

## 18. Tests added/fixed

Thay test tích hợp nghiệp vụ “plan → 30 ngày” bằng first-login 15 ngày. Thêm regression rollout disabled/old, login đồng thời và response, /me read-only, popup seen nhiều thiết bị, verification, stale price, scheduled renewal, future-start access, migration preservation, guard matrix. Frontend thêm denial không logout, fail/retry seen, scheduled banner; browser kiểm tra keyboard/cache/mobile/reduced motion/payment return. Sửa mock Google login để phù hợp việc đọc lại persisted state.

## 19. Backend test result

**502 passed; 20 skipped; 70 suites passed, 4 suites skipped.** Subscription và billing integration chạy trên MongoDB riêng ở loopback:27119, mỗi suite dùng database tên riêng. 20 test skipped thuộc AI context/local pipeline/exam activity/live Azure opt-in ngoài phạm vi thay đổi. Không dùng DB production. Lần chạy toàn bộ ban đầu bị timeout khi quá nhiều worker; chạy giới hạn 2 worker đã ổn định.

## 20. Frontend test result

**182/182 tests; 29/29 suites passed. Browser: 13/13 passed** gồm 5 case Trial mới và 8 case payment/Premium regression. Đã xem ảnh mobile/desktop thực tế. Browser dùng API mock; backend lifecycle được kiểm tra riêng với MongoDB thật và payOS mock.

## 21. Lint / formatting result

Backend và frontend không khai báo lệnh lint hay bộ rule lint. **Không thể ghi “lint pass”.** git diff --check đạt. Frontend format:check còn **173 file**; đối chiếu HEAD trong thư mục riêng có **172 file** đã lỗi sẵn. File chênh là useSubtitleSync.ts, không nằm trong diff task. 9 file frontend mới của task đã được format. Không mass-format phần còn lại vì tạo thay đổi ngoài scope.

## 22. Typecheck result

Backend npm run typecheck: PASS. Frontend npm run typecheck: PASS. Build backend cũng biên dịch TypeScript thành công. Không dùng lint-disable để che lỗi mới.

## 23. Build result

Backend npm run build: PASS. Frontend npm run build: PASS. Vite còn warning bundle lớn hơn 500kB, không làm build fail; không thêm thư viện cho popup. Build output chỉ local, không deploy.

## 24. Remaining TODOs / limitations

1. Thiết lập lint/rules của dự án và xử lý debt format theo một task riêng trước khi nghiệm thu checklist yêu cầu lint pass.
2. Khi rollout: người triển khai đặt enabled=true và cutoff thực tế có timezone; review migration dry-run nếu cần history reconciliation. Chưa thay cấu hình production.
3. Chạy một checkout/webhook thật ở môi trường merchant phù hợp để xác nhận cấu hình provider/deployment. Tests hiện tại không chứng minh secret, callback URL hoặc kết nối production đúng.
4. Bốn nhóm test tích hợp ngoài scope còn opt-in; không tuyên bố đã chạy toàn bộ dịch vụ Azure/AI/video.

## 25. Final confirmation checklist

- [x] Register chưa start Trial.
- [x] First authenticated login start Trial.
- [x] Trial = 15 × 24h UTC.
- [x] Một account chỉ một Trial, không reset theo login/device/cache.
- [x] Old account không nhận Trial.
- [x] Trial có quyền Premium theo guards hiện có.
- [x] Trial expiry chặn Premium tại deadline.
- [x] Expiry không xóa account hoặc dữ liệu học.
- [x] Popup không hiện lại sau acknowledgement thành công.
- [x] Seen state lưu backend, idempotent.
- [x] Pricing không còn Trial CTA/activation.
- [x] Không còn copy Trial 30 ngày trong runtime/script liên quan.
- [x] Không Voucher flow.
- [x] Không Add Card.
- [x] Không recurring.
- [x] Không auto-charge.
- [x] Trial không gọi payOS hoặc tạo payment 0đ.
- [x] payOS code path và regression tests đạt với provider mô phỏng.
- [ ] Giao dịch payOS thật trên môi trường triển khai đã xác minh.
- [x] Payment webhook/receipt idempotent.
- [x] Mua trong Trial không mất ngày Trial.
- [x] Paid/Admin Premium không bị Trial expiry downgrade.
- [x] Frontend stale state/403/deadline được xử lý, không logout.
- [x] Các kiểm tra security trong phạm vi code/test đạt.
- [x] Tests liên quan đạt; test skipped đã nêu rõ.
- [ ] Lint pass toàn workspace — chưa có cấu hình.
- [ ] Format check toàn frontend — debt có sẵn nêu trên.
- [x] Typecheck backend/frontend đạt.
- [x] Production build backend/frontend đạt.

Không có Critical/High đã biết còn mở sau sửa. Không đồng nhất kết quả code/test local với nghiệm thu production.
