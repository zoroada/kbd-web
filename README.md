# Vial Studio

使用 HTML、CSS 和 JavaScript 实现的 Vial 键盘配置网页，通过 WebHID 直接与键盘通讯。运行文件均在 `dist/`，无需后端或 Node.js。

## 使用

本地运行：

```sh
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
```

打开 http://127.0.0.1:5173/ ，使用支持 WebHID 的桌面 Chrome 或 Edge。公网部署使用 HTTPS，将 `dist/` 的内容作为网站根目录。

## 功能

- 多层按键映射、改键后自动选择下一键、旋钮双方向映射。
- Vial/VIA 定义、KLE 和 QMK 布局 JSON 预览；布局选项、旋转和异形键帽。
- 双语键码提示、自定义 User 键码、修饰组合键和基础键选择。
- 宏动作、文本编辑、排序、延时及保存；Tap Dance、Combo、Key Override、Alt Repeat Key。
- QMK 设置；QMK 背光、RGB Light 和 VialRGB 灯效、颜色、亮度及速度。
- 布局与硬件矩阵测试、按键记录、测试期间屏蔽网页键盘操作。
- 物理解锁、锁定、进入 Bootloader、断开连接及配置备份恢复。

目标协议为 VIA 9 / Vial 0–6，具体功能取决于设备固件和定义。选择灯光参数后立即应用，“保存”将参数保存到设备。

## 已知限制

- 尚未完成所有功能的实机回归，不能保证所有设备兼容。
- 备份为本项目的 JSON 格式，不兼容原版 `.vil`；当前备份不包含灯光。
- 未实现宏录制及固件刷写；进入 Bootloader 不等于刷写固件。
- 仅加载布局 JSON 时为预览模式，不会写入硬件。

## 发布与源码

`dist/` 包含网站所需文件。测试、生成脚本和参考仓库不参与网页运行，工程中保留供开发使用；Git 忽略规则见 `.gitignore`。

网页底部提供许可证、第三方说明和 GitHub 源码入口：https://github.com/zoroada/kbd-web 。

发布时上传 `dist/` 全部内容，不需要生成源码压缩包。GitHub 仓库中的 `dist/` 保留未压缩的 HTML、JavaScript、CSS 和配置数据。请将每次网站发布对应的源码同步提交到仓库，并用版本标签记录发布版本。

版权说明更新时，同步修改 `THIRD_PARTY_NOTICES.md`、`dist/third-party.html` 和 `dist/THIRD_PARTY_NOTICES.txt`；保留 `LICENSE`、`dist/LICENSE.txt` 和第三方文件内的版权声明。

本项目按 GPL-2.0-or-later 发布，见 `LICENSE`。协议及界面参考 vial-kb/vial-gui 和 vial-kb/vial-web；XZ 解压组件及依赖归属见 `THIRD_PARTY_NOTICES.md`。本项目不是 Vial 官方发布版本。
