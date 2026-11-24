const fs = require('fs');
const path = require('path');
const { pluginMarket } = require('../rules-loader');

const TEMPLATE_PATH = path.join(__dirname, 'runtime-template.js');
const SENTINEL = 'CSSZH_PluginMarket';

function buildMarketRuntime() {
    const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    return tpl
        .replace('__CSSZH_TRANSLATE_KEY_JSON__', JSON.stringify(pluginMarket.MARKET_TRANSLATE_KEY))
        .replace('__CSSZH_NAME_DICT_JSON__', JSON.stringify(pluginMarket.pluginNameDict))
        .replace('__CSSZH_DESC_DICT_JSON__', JSON.stringify(pluginMarket.descriptionDict))
        .replace('__CSSZH_FRAGMENT_RULES_JSON__', JSON.stringify(pluginMarket.fragmentRules))
        .replace('__CSSZH_UI_DICT_JSON__', JSON.stringify(pluginMarket.uiDict));
}

function buildPluginMarketInjection(runtimeStr) {
    return `<!-- ${SENTINEL} -->\n<script>\n${runtimeStr}\n</script>`;
}

function translatePluginMarket(htmlPath, productJsonPath, { writeFileSafe, fixProductHash, log }) {
    if (!htmlPath || !fs.existsSync(htmlPath)) return false;
    const injection = buildPluginMarketInjection(buildMarketRuntime());
    let html = fs.readFileSync(htmlPath, 'utf8');
    if (html.includes(SENTINEL)) {
        const marker = new RegExp(`<!-- ${SENTINEL} -->[\\s\\S]*?</script>\\n?`);
        html = marker.test(html) ? html.replace(marker, `${injection}\n`) : html.replace(`<!-- ${SENTINEL} -->`, injection);
    } else {
        html = html.includes('</body>') ? html.replace('</body>', `${injection}\n</body>`) : `${html}\n${injection}`;
    }
    writeFileSafe(htmlPath, html, 'utf8');
    const hashUpdated = fixProductHash(html, productJsonPath, 'workbench.html');
    log(`已注入插件市场汉化运行时（product.json 校验值${hashUpdated ? '已更新' : '无需更新'}）。`);
    return true;
}

module.exports = { buildPluginMarketInjection, buildMarketRuntime, translatePluginMarket, TEMPLATE_PATH, SENTINEL };