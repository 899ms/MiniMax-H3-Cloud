<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="plugins/minimax-h3-cloud/assets/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="plugins/minimax-h3-cloud/assets/logo.svg">
    <img src="plugins/minimax-h3-cloud/assets/logo.svg" width="136" alt="MiniMax H3 Cloud Logo">
  </picture>
</p>

<h1 align="center">MiniMax H3 Cloud for Codex</h1>

<p align="center">云端 GPU 驱动的 MiniMax H3 视频生成插件</p>

在 Codex 中使用云端 GPU 生成 MiniMax H3 视频（暂时支持优云智算平台，后续会新增其他平台）。插件负责选择算力、创建或启动实例、准备 ComfyUI Runtime、提交工作流、下载 MP4，并在任务完成或失败后关机。

支持三类生成方式：文生视频、关键帧生视频（首帧、尾帧或首尾帧）和参考图生视频（1–9 张参考图）。

> [!IMPORTANT]
> 本仓库不包含 MiniMax H3 模型权重。模型使用受 [MiniMax H3 Community License Agreement](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE) 约束，该协议目前明确排除欧盟、英国、韩国和美国等地区。位于排除地区的用户需要先取得 MiniMax 的单独授权。请在使用前自行确认所在地、用途和平台服务均符合相关条款。

## 前置条件

- macOS 或 Linux；
- 支持插件的 Codex；
- Node.js 20 或更高版本；
- `ssh` 和 `ffprobe`；
- 优云智算账号和 API Key；
- [CompShare CLI](https://github.com/compshare-cn/compshare-cli) 0.3.5 或更高版本。

可以通过 PyPI 安装 CompShare CLI：

```bash
python3 -m pip install --upgrade compshare-cli
compshare --version
```

## 安装插件

把本仓库加入 Codex Marketplace，然后安装插件：

```bash
codex plugin marketplace add Sac-Y/MiniMax-H3-Cloud --ref main
codex plugin add minimax-h3-cloud@sac-y-minimax-h3
```

安装后，在 Codex 中调用 `MiniMax H3 Cloud` 并提出视频生成需求。首次使用会按以下顺序逐步引导：

1. 注册或登录优云智算，并通过官方 CLI 在本机隐藏保存 API Key；
2. 查看当前 GPU 价格与库存并选择配置；
3. 提供提示词、图片、画幅、时长和清晰度；
4. 确认视频参数与预计费用；
5. 自动生成、在 Codex 中播放并提供 MP4 下载。

插件不会要求把 API Key 发到对话中。凭证由 CompShare CLI 保存在用户本机；插件配置默认写入 `~/.config/minimax-h3-cloud/config.json`，视频默认写入 `~/.local/share/minimax-h3-cloud/outputs/`。这两个位置都在插件安装目录之外，升级插件不会覆盖用户数据。

## 费用与资源

插件本身免费。GPU、系统盘、镜像等费用由优云智算直接计费；创建付费资源前必须由用户确认。插件默认设置 30 分钟兜底关机，并在单次任务结束后立即关机。

云端库存会实时变化。没有符合条件的资源时，插件会回到 GPU 选择步骤，不会静默更换到用户未确认的配置。

## 许可证

插件代码采用 [MIT License](LICENSE)。模型及工作流许可见 [第三方许可说明](THIRD_PARTY_NOTICES.md)。
