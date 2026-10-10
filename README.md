# GitHub PR Repository Star Filter

## Visited PR tracking (v0.3)

The userscript also records pull requests opened in GitHub and marks them in later global search results. The visit history is stored through Tampermonkey's local storage, separately from the page `localStorage`, and does not use the GitHub API. In the search-page panel, enable **Hide visited PRs** to hide previously opened results, or use **Clear visited history** to remove the local history.

To record visits, the userscript must be enabled on both `github.com/search` and GitHub pull-request detail pages. The updated metadata includes the PR page match. Visit records are local to the browser profile and are not synchronized to other computers.

[中文](#中文说明) | [English](#english)

## 中文说明

这是一个用于 GitHub 全局 Issues/Pull Requests 搜索结果页的轻量 Tampermonkey 用户脚本。它会显示每条 Pull Request 所属仓库的 star 数，并可根据用户设置的最低 star 数隐藏不符合条件的结果。

### v0.2 功能

- 自动识别 GitHub 全局搜索结果中的 Pull Request 链接。
- 通过 GitHub REST API 获取仓库元数据。
- 在每条 PR 旁显示紧凑的 star 数徽标。
- 支持配置最低 star 阈值，默认为 `100`。
- 提供 **Only qualified PRs** 开关，仅显示达到阈值的 PR。
- 每个仓库在一次页面会话中只请求一次，并将成功结果缓存到浏览器存储中 24 小时。
- 使用 `MutationObserver` 自动处理动态页面更新、搜索条件变化和翻页。
- 明确显示 API 限流、仓库不存在或为私有、请求超时等错误状态。
- 可在右下角面板保存或清除 GitHub Token；Token 由 Tampermonkey 独立存储，不写入脚本源代码或网页的 `localStorage`。

### 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展。
2. 在 Chrome 地址栏打开 `chrome://extensions/`，找到 Tampermonkey 并点击 **详细信息**，然后开启 **允许用户脚本**（Allow User Scripts）。如果没有看到此选项，请先打开扩展程序页面右上角的 **开发者模式**。
3. 在 Tampermonkey 的扩展详情页，将 **网站访问权限** 设置为 **在所有网站上**；也可以仅允许 `github.com`，但必须确保 Tampermonkey 有权在 GitHub 页面运行。
4. 打开 Tampermonkey 管理面板，选择 **添加新脚本**（Create a new script）。
5. 删除默认模板，将 `github-pr-filter.user.js` 的全部内容粘贴进去。
6. 保存脚本，并确认脚本处于启用状态。
7. 打开或刷新 GitHub 搜索页。如果脚本仍未出现，请点击浏览器工具栏中的 Tampermonkey 图标，确认当前页面的运行脚本列表中包含 **GitHub PR Repository Star Filter**。

如果本项目之后发布到 GitHub，也可以打开 `.user.js` 文件的 Raw 页面，Tampermonkey 通常会自动弹出安装界面。

### 使用方法

1. 打开包含 Pull Request 的 GitHub 全局搜索页，例如：`https://github.com/search?q=is%3Apr&type=pullrequests`
2. 稍等片刻，PR 旁的 `★ loading…` 徽标会更新为仓库 star 数。
3. 使用页面右下角的 **PR star filter** 面板：
   - 在 **Min stars** 中设置最低 star 阈值。
   - 启用 **Only qualified PRs**，隐藏已成功加载但未达到阈值的 PR。
4. 可以正常修改搜索条件或翻页，新加载的结果会被自动识别。

阈值和过滤开关会保存在浏览器中。成功获取的仓库数据会缓存 24 小时。

### 可选 GitHub Token

脚本无需 Token 即可使用，但 GitHub 对未认证 API 请求的速率限制较低。

在右下角面板的 **GitHub token** 输入框中粘贴 Token，然后点击 **Save token**。Token 由 Tampermonkey 独立保存，不会写入脚本源代码；保存后页面会自动刷新并重新请求 star 数。点击 **Clear** 可删除已保存的 Token。

请勿将 Token 粘贴到源代码、提交到仓库或分享给其他人。

### 当前限制

- GitHub 可能调整搜索结果页的 HTML 结构，届时可能需要更新页面选择器。
- 未认证时只能获取公开仓库的元数据。
- API 请求失败的结果会保留并显示错误，不会被当作低于阈值的结果隐藏。
- 当前仅面向 GitHub 全局 `/search` 页面，不支持单个仓库内的 Pull Requests 列表。
- 缓存中的 star 数最多可能有 24 小时延迟。

### 许可证

MIT

---

## English

A lightweight Tampermonkey userscript for GitHub's global Issues/Pull Requests search results. It displays the star count of each pull request's repository and can hide results below a configurable threshold.

### Features (v0.2)

- Detects pull-request links on GitHub global search pages.
- Fetches repository metadata from the GitHub REST API.
- Shows a compact star-count badge next to each pull request.
- Supports a configurable minimum star threshold, defaulting to `100`.
- Provides an **Only qualified PRs** option to show only results meeting the threshold.
- Requests each repository only once per page session and caches successful responses in browser storage for 24 hours.
- Uses `MutationObserver` to handle dynamic page updates, search changes, and pagination.
- Shows clear messages for rate limits, missing/private repositories, timeouts, and other API errors.
- Saves or clears a GitHub token from the bottom-right panel using Tampermonkey storage, without placing it in the userscript source or page `localStorage`.

### Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open `chrome://extensions/` in Chrome, find Tampermonkey, select **Details**, and enable **Allow User Scripts**. If this option is not visible, first enable **Developer mode** in the top-right corner of the Extensions page.
3. On Tampermonkey's extension details page, set **Site access** to **On all sites**. You may instead allow only `github.com`, but Tampermonkey must have permission to run on GitHub pages.
4. Open the Tampermonkey dashboard and choose **Create a new script**.
5. Delete the default template and paste in the complete contents of `github-pr-filter.user.js`.
6. Save the script and make sure it is enabled.
7. Open or refresh the GitHub search page. If the interface still does not appear, click the Tampermonkey toolbar icon and confirm that **GitHub PR Repository Star Filter** is listed as running on the current page.

If this project is published on GitHub later, open the Raw view of the `.user.js` file and Tampermonkey should offer to install it directly.

### Usage

1. Open a GitHub global search page containing pull requests, for example: `https://github.com/search?q=is%3Apr&type=pullrequests`
2. Wait briefly while the `★ loading…` badges next to the PRs change to repository star counts.
3. Use the **PR star filter** panel in the bottom-right corner:
   - Set the desired threshold under **Min stars**.
   - Enable **Only qualified PRs** to hide successfully loaded repositories below the threshold.
4. Change pages or search terms normally. Newly loaded results are detected automatically.

The threshold and filter setting persist in browser storage. Successfully retrieved repository data is cached for 24 hours.

### Optional GitHub Token

No token is required, but unauthenticated GitHub API requests have a relatively low rate limit.

Paste the token into **GitHub token** in the bottom-right panel and select **Save token**. Tampermonkey stores it separately from the userscript source. The page reloads automatically so failed star requests can run again. Select **Clear** to delete the saved token.

Do not paste the token into source code, commit it to a repository, or share it with anyone.

### Current Limitations

- GitHub may change its search-result HTML, which can require selector updates.
- Only public repository metadata is available without authentication.
- Results with API failures remain visible with an error message; they are not treated as below-threshold results.
- The script targets GitHub global `/search` pages, not repository-local Pull Requests lists.
- Cached star counts can be up to 24 hours old.

### License

MIT
