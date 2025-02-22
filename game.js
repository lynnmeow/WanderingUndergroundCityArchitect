/**
 * 流浪地下城管理模拟器 - 完整版
 * 包含全部游戏逻辑和注释
 */

// 游戏全局状态
const gameState = {
    running: false,
    currentYear: 2165,
    intervalId: null,
    progressInterval: null,
    strategy: "均衡发展",
    birthRate: 10,

    // 游戏属性
    attributes: {
        peopleSupport: 50,
        security: 50,
        civilization: 90,
        resources: 20000000,
        population: 1000000,
        researchLevel: 1,
        constructionLevel: 1,
        talentLevel: 1,
        researchConsumedTotal: 0,
        constructionConsumedTotal: 0,
        totalResourcesAdded: 0
    },

    // 策略配置
    strategies: {
        "均衡发展": {},
        "高速发展": {
            populationCost: 1.3,
            constructionCost: 1.3,
            researchCost: 2,
            peopleSupport: -2,
            security: +2
        },
        "资源调控": {
            populationCost: 0.7,
            peopleSupport: -1
        },
        "民生安定": {
            populationCost: 1.3,
            peopleSupport: +1
        },
        "工程建设": {
            constructionCost: 1.3,
            security: -1
        },
        "科学研究": {
            researchCost: 2
        },
        "人才培养": {
            populationCost: 1.5
        },
        "文化发展": {
            civilization: +1,
            peopleSupport: +0.5
        }
    },

    lastValues: {} // 用于记录属性变化
};

// ================== 初始化部分 ==================
function initGame() {
    // 强制显示开始界面
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('endScreen').style.display = 'none';

    initStrategies();
    initEventListeners();
    initTooltips();
    console.log("游戏初始化完成");
}

function initStrategies() {
    const container = document.getElementById('strategyButtons');
    Object.keys(gameState.strategies).forEach(strategy => {
        const btn = document.createElement('button');
        btn.className = `strategy-btn ${strategy === '均衡发展' ? 'active' : ''}`;
        btn.textContent = strategy;
        btn.dataset.tip = getStrategyTip(strategy);
        btn.addEventListener('click', () => setStrategy(strategy));
        container.appendChild(btn);
    });
}

function initEventListeners() {
    const birthRate = document.getElementById('birthRate');
    birthRate.addEventListener('input', function() {
        gameState.birthRate = Math.min(30, Math.max(0, parseInt(this.value) || 0));
        document.getElementById('birthRateValue').textContent = this.value;
    });
}

// ================== 核心游戏逻辑 ==================
function startGame() {
    const cityName = document.getElementById('cityName').value.trim();
    if (!cityName) return alert("请输入地下城名称");

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('fullCityName').textContent = `${cityName}地下城`;

    gameState.running = true;
    gameState.lastValues = {...gameState.attributes};
    startYearCycle();
}

function startYearCycle() {
    processYear();
    gameState.intervalId = setInterval(() => {
        gameState.currentYear >= 4665 ? endGame() : processYear();
    }, 10000);
}

// 将 endGame 函数移到这里，确保在使用前定义
function endGame() {
    // 清理定时器
    clearInterval(gameState.intervalId);
    clearInterval(gameState.progressInterval);
    
    // 停止游戏运行
    gameState.running = false;
    
    // 获取结局
    const ending = determineEnding();
    
    // 计算游戏总年数
    const totalYears = gameState.currentYear - 2165;
    
    // 生成游戏总结
    const summary = generateGameSummary(totalYears, gameState.attributes);
    
    // 显示结局界面
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('endScreen').style.display = 'block';
    document.getElementById('endingTitle').textContent = ending.title;
    document.getElementById('endingDescription').textContent = ending.description;
    
    // 添加游戏总结到结局界面
    const summaryElement = document.createElement('div');
    summaryElement.className = 'game-summary';
    summaryElement.innerHTML = summary;
    document.querySelector('.ending-content').insertBefore(
        summaryElement,
        document.querySelector('.restart-btn')
    );
    
    // 添加最终日志
    addLog(`游戏结束：${ending.title}`, true);
}

function processYear() {
    startProgressBar();
    calculateYearlyChanges();
    updateDisplays();
    
    // 检查游戏结束条件
    if (checkEnding()) {
        endGame();
        return;
    }
    
    logDebugInfo();
}

// ================== 计算逻辑 ==================
function calculateYearlyChanges() {
    const attr = gameState.attributes;
    const strategy = gameState.strategies[gameState.strategy];
    gameState.lastValues = {...attr};

    // 人口变化
    const births = Math.floor(attr.population * 0.01 * gameState.birthRate * 0.1);
    const deaths = Math.ceil(attr.population * 0.01);
    attr.population += births - deaths;

    // 资源计算
    const researchCost = 500000 * attr.researchLevel * (strategy.researchCost || 1);
    const constructionCost = 1000000 * attr.constructionLevel * (strategy.constructionCost || 1);
    
    // 修改：人口消耗计算
    const populationCost = attr.population * 12;  // 基础人口消耗
    const adjustedPopulationCost = populationCost * (strategy.populationCost || 1);  // 考虑策略加成

    // 资源收入计算
    let resourceIncome = 15000000 * attr.researchLevel;
    if (attr.totalResourcesAdded >= 1e11) resourceIncome = 0;
    resourceIncome = Math.min(resourceIncome, 2e8);

    // 总资源变化
    attr.resources += resourceIncome - (researchCost + constructionCost + adjustedPopulationCost);
    attr.totalResourcesAdded += resourceIncome;
    attr.researchConsumedTotal += researchCost;
    attr.constructionConsumedTotal += constructionCost;

    // 属性变化
    attr.peopleSupport += (strategy.peopleSupport || 0) - 0.1;
    attr.security += (strategy.security || 0) - 0.1;
    attr.civilization += (strategy.civilization || 0) - 0.1;

    // 等级提升
    updateLevel('research', attr.researchConsumedTotal);
    updateLevel('construction', attr.constructionConsumedTotal);

    // 人才等级
    if (gameState.strategy === '人才培养') {
        attr.talentLevel = Math.min(attr.talentLevel + 1, 25);
    } else if (gameState.currentYear % 2 === 0) {
        attr.talentLevel = Math.max(attr.talentLevel - 1, 1);
    }

    clampAttributes();
    
    if (attr.peopleSupport <= 0 || attr.security <= 0 || attr.civilization <= 0) {
        return;
    }
}

function updateLevel(type, consumed) {
    const attr = gameState.attributes;
    const currentLevel = attr[`${type}Level`];
    const required = 5000000 + (currentLevel - 1) * 12000000;
    
    if (consumed >= required) {
        if (type === 'construction') {
            // 修复建设等级限制逻辑
            if (currentLevel + 1 > attr.researchLevel) {
                addLog("⚠️ 建设等级已达到上限，请先提升科研等级！", true);
                return;
            }
        }
        
        // 处理跨级升级
        const possibleLevels = Math.floor((consumed - 5000000) / 12000000) + 1;
        const newLevel = Math.min(
            currentLevel + possibleLevels, 
            100,
            type === 'construction' ? attr.researchLevel : 100
        );
        
        attr[`${type}Level`] = newLevel;
        addLog(`🎉 ${type === 'research' ? '科研' : '建设'}等级提升至 ${newLevel}`);
    }
}

function clampAttributes() {
    const attr = gameState.attributes;
    
    attr.peopleSupport = Math.max(0, Math.min(attr.peopleSupport, 100));
    attr.security = Math.max(0, Math.min(attr.security, 100));
    attr.civilization = Math.max(0, Math.min(attr.civilization, 100));
    attr.resources = Math.max(0, attr.resources);
    attr.population = Math.max(0, attr.population);
}

// ================== 界面更新 ==================
function updateDisplays() {
    const attr = gameState.attributes;
    
    // 更新属性显示
    updateDisplay('peopleSupport', attr.peopleSupport.toFixed(2));
    updateDisplay('security', attr.security.toFixed(2));
    updateDisplay('civilization', attr.civilization.toFixed(2));
    updateDisplay('resources', formatNumber(attr.resources));
    updateDisplay('population', formatNumber(attr.population));
    updateDisplay('researchLevel', attr.researchLevel);
    updateDisplay('constructionLevel', attr.constructionLevel);
    updateDisplay('talentLevel', attr.talentLevel);

    // 更新年份和倒计时
    document.getElementById('currentYear').textContent = ++gameState.currentYear;
    updateCountdown();
    
    addLog(`年度结算：人口 ${formatNumber(attr.population)}，资源 ${formatNumber(attr.resources)}`);
    checkWarnings();
}

function updateDisplay(id, value) {
    const element = document.querySelector(`[data-attribute="${id}"] .attr-value`);
    if (element) element.textContent = value;
}

function startProgressBar() {
    let width = 0;
    clearInterval(gameState.progressInterval);
    gameState.progressInterval = setInterval(() => {
        width += 1;
        document.getElementById('yearProgress').style.width = `${width}%`;
        if (width >= 100) {
            clearInterval(gameState.progressInterval);
            document.querySelector('.time-progress-container')
                .classList.add('year-progress-complete');
            setTimeout(() => {
                document.querySelector('.time-progress-container')
                    .classList.remove('year-progress-complete');
            }, 1000);
        }
    }, 100);
}

// 倒计时更新函数
function updateCountdown() {
    const remainingYears = 4665 - gameState.currentYear;
    const countdownNumber = document.querySelector('.countdown-number');
    const countdownNumberEn = document.querySelector('.countdown-number-en');
    
    if (countdownNumber && countdownNumberEn) {
        countdownNumber.textContent = remainingYears;
        countdownNumberEn.textContent = remainingYears;
    }
}

// ================== 结局系统 ==================
function checkEnding() {
    const attr = gameState.attributes;
    
    return (
        attr.population <= 0 || 
        attr.resources <= 0 || 
        attr.peopleSupport <= 0 || 
        attr.security <= 0 || 
        attr.civilization <= 0 || 
        gameState.currentYear >= 4665
    );
}

function determineEnding() {
    const attr = gameState.attributes;
    const currentYear = gameState.currentYear;
    
    const endings = [
        { condition: attr.population <= 0, info: getEnding(1) },
        { condition: attr.resources <= 0, info: getEnding(2) },
        { condition: attr.peopleSupport <= 0, info: getEnding(3) },
        { condition: attr.security <= 0, info: getEnding(4) },
        { condition: attr.civilization <= 0, info: getEnding(5) },
        { condition: currentYear >= 4665, info: getEnding(0) },
        { condition: attr.security > 90 && attr.peopleSupport > 90, info: getEnding(12) },
        { condition: attr.security > 50 && attr.security < 90 && 
                    attr.peopleSupport > 50 && attr.peopleSupport < 90, info: getEnding(21) },
        { condition: attr.security < 50 && attr.peopleSupport < 50, info: getEnding(22) },
        { condition: attr.security < 50 && attr.peopleSupport >= 50, info: getEnding(23) },
        { condition: attr.security >= 50 && attr.peopleSupport < 50, info: getEnding(24) },
        { condition: true, info: getEnding(-1) } // 默认结局
    ];

    return endings.find(e => e.condition).info;
}

function getEnding(id) {
    const endings = {
        0: { title: "抵达新家园", description: "经过2500年的漫长旅程，人类终于在新的星系建立了文明" },
        1: { title: "何为文明", description: "没有人的文明，毫无意义。" },
        2: { title: "快乐百年", description: "后代的事，与我何干？" },
        3: { title: "冰雕艺术家", description: "放逐，成为冰雕。" },
        4: { title: "我不活啦", description: "毫无防护的地下城，可能毁于任何意外。" },
        5: { title: "何为人？", description: "在流浪的尽头，人类要回答的不是'能否抵达'，而是'抵达后我们是否还配被称为人类'。" },
        12: { title: "未知希望", description: "在这里，真的可以看到蓝天、鲜花挂满枝头吗？" },
        21: { title: "沉默黑暗", description: "人类已经尽力了……" },
        22: { title: "微光熄灭", description: "勉强到达目标星系，却无力继续向前了……" },
        23: { title: "无尽寒冬", description: "虽然到达了目的地，但已无力防护自然灾害" },
        24: { title: "哗变反叛", description: "既然到达了目的地，这里不再需要管理者" },
        "-1": { title: "未知结局", description: "人类以未知的状态继续着他们的旅程……" }
    };
    return endings[id];
}

// ================== 辅助工具 ==================
function formatNumber(num) {
    return Math.round(num).toLocaleString('en-US');
}

function addLog(message, isWarning = false) {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry${isWarning ? ' warning' : ''}`;
    entry.innerHTML = `<span class="log-year">${gameState.currentYear}</span> ${message}`;
    log.prepend(entry);
}

function checkWarnings() {
    const attr = gameState.attributes;
    const warnings = [
        [attr.peopleSupport < 20, `⚠️ 民心过低！当前值：${attr.peopleSupport.toFixed(2)}`],
        [attr.security < 20, `⚠️ 安全指数过低！当前值：${attr.security.toFixed(2)}`],
        [attr.civilization < 20, `⚠️ 文明指数过低！当前值：${attr.civilization.toFixed(2)}`],
        [attr.resources < 200000, `⚠️ 资源即将耗尽！当前剩余：${formatNumber(attr.resources)}`],
        [attr.population < 100000, `⚠️ 人口危机！当前人口：${formatNumber(attr.population)}`]
    ];
    warnings.forEach(([condition, message]) => condition && addLog(message, true));
}

// ================== 调试工具 ==================
function logDebugInfo() {
    const attr = gameState.attributes;
    const strategy = gameState.strategies[gameState.strategy];
    
    console.groupCollapsed(`[调试信息] ${gameState.currentYear}年 地下城状态`);
    
    // 添加升级验证信息
    const calculateLevelInfo = (type) => {
        const currentLevel = attr[`${type}Level`];
        const consumed = attr[`${type}ConsumedTotal`];
        const required = 5000000 + (currentLevel - 1) * 12000000;
        const possibleLevels = Math.floor((consumed - 5000000) / 12000000) + 1;
        
        return {
            "当前等级": currentLevel,
            "升级需求": formatNumber(required),
            "累计消耗": formatNumber(consumed),
            "可升级级数": possibleLevels,
            "是否可升级": consumed >= required ? "✅" : "❌"
        };
    };

    console.table({
        "科研等级": calculateLevelInfo('research'),
        "建设等级": calculateLevelInfo('construction')
    });
    
    // 添加消耗信息
    const populationCost = attr.population * 12;
    const adjustedPopulationCost = populationCost * (strategy.populationCost || 1);
    
    console.table({
        "科研累计消耗": {
            "数值": formatNumber(attr.researchConsumedTotal),
            "单位": "资源"
        },
        "工程累计消耗": {
            "数值": formatNumber(attr.constructionConsumedTotal),
            "单位": "资源"
        },
        "人口维持消耗": {
            "基础消耗": formatNumber(populationCost),
            "策略调整后": formatNumber(adjustedPopulationCost),
            "单位": "资源"
        },
        "总资源产出": {
            "数值": formatNumber(attr.totalResourcesAdded),
            "单位": "资源"
        }
    });
    
    // 添加中文标注的属性变化
    const changes = {};
    Object.entries(gameState.lastValues).forEach(([key, val]) => {
        if (typeof val === 'number') {
            const labels = {
                peopleSupport: "民心指数",
                security: "安全指数",
                civilization: "文明指数",
                resources: "资源储备",
                population: "人口数量",
                researchLevel: "科研等级",
                constructionLevel: "工程等级",
                talentLevel: "人才等级"
            };
            
            changes[labels[key] || key] = {
                "原始值": val.toFixed(2),
                "当前值": attr[key].toFixed(2),
                "变化量": (attr[key] - val).toFixed(2),
                "变化率": ((attr[key] - val) / val * 100).toFixed(2) + "%"
            };
        }
    });
    console.table(changes);
    console.groupEnd();
}

// ================== 工具提示系统 ==================
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    document.querySelectorAll('[data-tip]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            showTooltip(e);
            setTimeout(hideTooltip, 2000);
        });
    });
}

function showTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = e.target.dataset.tip;
    tooltip.style.left = `${e.target.getBoundingClientRect().left}px`;
    tooltip.style.top = `${e.target.getBoundingClientRect().bottom + 5}px`;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// ================== 策略系统 ==================
function setStrategy(strategy) {
    gameState.strategy = strategy;
    document.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === strategy);
    });
    addLog(`策略变更为：${strategy}`);
}

function getStrategyTip(strategy) {
    const tips = {
        "均衡发展": "平衡各项发展，无特殊加成",
        "高速发展": "⚡人口/工程消耗+30%，科研消耗+100%，安全+2/年，民心-2/年",
        "资源调控": "🔋人口消耗-30%，民心-1/年",
        "民生安定": "🏠人口消耗+30%，民心+1/年",
        "工程建设": "🏗️工程消耗+30%，安全-1/年",
        "科学研究": "🔬科研消耗+100%",
        "人才培养": "🎓人口消耗+50%，人才等级每年提升",
        "文化发展": "📚文明+1/年，民心+0.5/年，消耗文明值×10万资源"
    };
    return tips[strategy];
}

// ================== 新增游戏总结生成函数 ==================
function generateGameSummary(totalYears, attr) {
    const getStatusClass = (value, threshold) => value >= threshold ? 'positive' : 'negative';
    
    return `
        <div class="summary-section">
            <h3>📊 游戏总结</h3>
            <div class="summary-header">
                <p>结束年份：${gameState.currentYear}年</p>
                <p>生存时长：${totalYears}年</p>
            </div>
            <div class="final-stats">
                <p class="${getStatusClass(attr.population, 1000000)}">人口规模：${formatNumber(attr.population)}</p>
                <p class="${getStatusClass(attr.resources, 1000000)}">资源储备：${formatNumber(attr.resources)}</p>
                <p class="${getStatusClass(attr.researchLevel, 50)}">科研等级：${attr.researchLevel}</p>
                <p class="${getStatusClass(attr.constructionLevel, 50)}">建设等级：${attr.constructionLevel}</p>
                <p class="${getStatusClass(attr.talentLevel, 10)}">人才等级：${attr.talentLevel}</p>
                <p class="${getStatusClass(attr.peopleSupport, 50)}">民心指数：${attr.peopleSupport.toFixed(2)}</p>
                <p class="${getStatusClass(attr.security, 50)}">安全指数：${attr.security.toFixed(2)}</p>
                <p class="${getStatusClass(attr.civilization, 50)}">文明指数：${attr.civilization.toFixed(2)}</p>
            </div>
        </div>
    `;
}

// ================== 启动游戏 ==================
window.onload = initGame;