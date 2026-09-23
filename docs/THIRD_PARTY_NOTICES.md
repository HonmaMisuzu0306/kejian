# 第三方组件说明

课间 V1.0.1 的本地截图识别包含以下开源组件：

- Tesseract.js 7.0.0，Apache License 2.0，<https://github.com/naptha/tesseract.js>
- tesseract.js-core 6.1.2，Apache License 2.0，<https://github.com/naptha/tesseract.js-core>
- `@tesseract.js-data/chi_sim` 1.0.0，MIT License，<https://www.npmjs.com/package/@tesseract.js-data/chi_sim>

完整许可证文本随对应 npm 包提供。本文件用于说明 APK 与 PWA 中新增的离线 OCR 运行时及语言数据来源。

文字识别修复版使用同一语言数据包的 `4.0.0` 完整模型，替换 `4.0.0_best_int` 压缩模型。文件在构建时解压并随 APK/PWA 分发，运行时不会向第三方请求模型或上传截图。
