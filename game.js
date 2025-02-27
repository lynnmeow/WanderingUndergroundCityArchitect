/**
 * 流浪地下城管理模拟器 - 完整版
 * 包含全部游戏逻辑和注释
 */

// 新增配置文件路径
const LEVEL_CONFIG_URL = './data/levelRequirements.json';
const EVENTS_CONFIG_URL = './data/events.json'; // 修正为正确的事件配置文件路径

// 游戏全局状态
const gameState = {
    running: false,
    currentYear: 2164,
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
            security: +1
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

    lastValues: {}, // 用于记录属性变化
    levelConfig: null,
    
    // 随机事件相关
    events: [], // 事件列表
    populationHistory: [], // 人口历史记录，用于判断人口下跌趋势
    populationDeclineYears: 0, // 连续人口下跌年数
    lastTriggeredEvents: [] // 用于记录触发的事件
};

// ================== 初始化部分 ==================
async function initGame() {
    // 强制显示开始界面
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('endScreen').style.display = 'none';

    initStrategies();
    initEventListeners();
    initTooltips();
    
    // 并行加载配置
    await Promise.all([
        loadLevelConfig(),
        loadEventsConfig() // 加载事件配置
    ]);
    
    console.log("游戏初始化完成，等级配置和事件配置加载完成");
}

async function loadLevelConfig() {
    try {
        const response = await fetch(LEVEL_CONFIG_URL);
        gameState.levelConfig = await response.json();
    } catch (error) {
        console.error("加载等级配置失败，使用默认配置", error);
        // 设置默认配置
        gameState.levelConfig = {
            research: Array.from({length: 100}, (_, i) => 5000000 + i * 12000000),
            construction: Array.from({length: 100}, (_, i) => 5000000 + i * 12000000)
        };
    }
}

// 新增：加载事件配置
async function loadEventsConfig() {
    try {
        const response = await fetch(EVENTS_CONFIG_URL);
        const data = await response.json();
        gameState.events = data.events;
        console.log(`成功加载${gameState.events.length}个随机事件`);
    } catch (error) {
        console.error("加载事件配置失败", error);
        gameState.events = []; // 如果加载失败，设置为空数组
    }
}

function initStrategies() {
    const container = document.getElementById('strategyButtons');
    Object.keys(gameState.strategies).forEach(strategy => {
        const btn = document.createElement('button');
        btn.className = `strategy-btn ${strategy === '均衡发展' ? 'active' : ''}`;
        btn.textContent = strategy;
        btn.dataset.tip = getStrategyTip(strategy);
        
        // 添加点击事件监听器
        btn.addEventListener('click', () => setStrategy(strategy));
        
        // 直接为策略按钮添加tooltip相关的事件处理
        btn.addEventListener('mouseenter', showTooltip);
        btn.addEventListener('mouseleave', hideTooltip);
        
        // 添加长按显示tooltip的处理，确保不影响点击事件
        let touchTimeout;
        let isTouchMoved = false;
        
        btn.addEventListener('touchstart', (e) => {
            isTouchMoved = false;
            touchTimeout = setTimeout(() => {
                if (!isTouchMoved) {
                    showTooltip(e);
                    setTimeout(hideTooltip, 2000);
                }
            }, 500); // 500ms长按阈值
        });
        
        btn.addEventListener('touchmove', () => {
            isTouchMoved = true;
            clearTimeout(touchTimeout);
        });
        
        btn.addEventListener('touchend', () => {
            clearTimeout(touchTimeout);
        });
        
        container.appendChild(btn);
    });
}

function initEventListeners() {
    const birthRate = document.getElementById('birthRate');
    birthRate.addEventListener('input', function() {
        gameState.birthRate = Math.min(30, Math.max(0, parseInt(this.value) || 0));
        document.getElementById('birthRateValue').textContent = (this.value * 0.1).toFixed(1);
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
    const totalYears = gameState.currentYear - 2164;
    
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
    
    // 先处理随机事件（立即生效）
    processRandomEvents();
    
    // 再计算年度变化
    calculateYearlyChanges();
    
    updateDisplays();
    
    // 新增：更新年度语录
    const quotes = [
        "Tips：低于500人，人类将灭绝。",
        "在流浪的尽头，人类要回答的不是'能否抵达'，而是'抵达后我们是否还配被称为人类'。", 
        "没有人的文明，毫无意义。",
        "最初，没有人在意这场灾难……",
        "无论最终结果将人类历史导向何处，我们决定，选择希望！",
        "从历史上看，人类的命运取决于人类的选择。",
        "危难当前，唯有责任。",
        "希望是像钻石一样珍贵的东西！希望是我们唯一回家的方向。",
        "人类的勇气和坚毅，必将被镌刻在星空之下。",
        "我信，我的孩子会信，孩子的孩子会信。",
        "我相信人类的勇气可以跨越时间，当下，未来。",
        "我相信，可以再次看到蓝天，鲜花，挂满枝头。",
        "我们的人一定可以完成任务，不计虚实，不计存亡。"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('yearMessage').textContent = randomQuote;

    // 检查游戏结束条件
    if (checkEnding()) {
        endGame();
        return;
    }
    
    logDebugInfo();
}

// ================== 随机事件系统 ==================
// 新增：处理随机事件
function processRandomEvents() {
    let triggeredEvents = []; // 用于记录触发的事件

    // 每年尝试触发两次随机事件
    for (let i = 0; i < 2; i++) {
        const triggeredEvent = checkForRandomEvent();
        if (triggeredEvent) {
            try {
                applyEventEffect(triggeredEvent);
                triggeredEvents.push(triggeredEvent); // 记录触发的事件
                console.log(`成功触发随机事件: ${triggeredEvent.name}`);
            } catch (error) {
                console.error(`处理随机事件时出错:`, error);
            }
        }
    }
    
    // 记录事件触发情况到gameState，用于调试日志
    gameState.lastTriggeredEvents = triggeredEvents;
    
    // 更新人口历史和下跌趋势
    updatePopulationTrend();
}

// 检查是否触发随机事件
function checkForRandomEvent() {
    if (!gameState.events || gameState.events.length === 0) {
        console.warn("事件列表为空，请检查事件配置是否正确加载");
        return null;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => {
        return checkEventCondition(event.condition);
    });
    
    if (availableEvents.length === 0) {
        console.log("没有符合当前条件的事件可触发");
        return null;
    }
    
    // 计算所有可用事件的概率总和
    let totalProbability = 0;
    const eventsWithProbability = availableEvents.map(event => {
        // 确保概率不超过1
        const probability = Math.min(event.probability, 1);
        totalProbability += probability;
        return { ...event, adjustedProbability: probability };
    });
    
    // 确保总概率不超过1
    totalProbability = Math.min(totalProbability, 1);
    
    console.log(`所有可用事件的概率总和: ${totalProbability}`);
    
    // 决定是否触发任何事件
    const randomValue = Math.random();
    if (randomValue >= totalProbability) {
        console.log(`未触发任何事件，随机值: ${randomValue.toFixed(4)}，需要小于: ${totalProbability.toFixed(4)}`);
        return null;
    }
    
    // 已决定触发事件，选择具体哪个事件
    // 使用相对概率（轮盘赌选择法）
    let cumulativeProbability = 0;
    const selectedEventValue = Math.random() * totalProbability; // 在总概率范围内随机选择
    
    for (const event of eventsWithProbability) {
        cumulativeProbability += event.adjustedProbability;
        
        if (selectedEventValue <= cumulativeProbability) {
            console.log(`事件触发成功: ${event.name}，相对概率: ${(event.adjustedProbability / totalProbability).toFixed(4)}`);
            return event;
        }
    }
    
    // 理论上不应该到达这里，但为了安全起见
    console.log("未能选择事件，返回第一个可用事件");
    return eventsWithProbability[0];
}

// 检查事件条件是否满足
function checkEventCondition(condition) {
    if (!condition || condition === "none") {
        return true;
    }
    
    // 使用eval安全地评估条件
    try {
        // 创建包含游戏属性的上下文
        const attr = gameState.attributes;
        const currentYear = gameState.currentYear;
        const populationDeclineYears = gameState.populationDeclineYears;
        
        // 构建条件表达式
        const conditionExpression = condition
            .replace(/researchLevel/g, 'attr.researchLevel')
            .replace(/constructionLevel/g, 'attr.constructionLevel')
            .replace(/talentLevel/g, 'attr.talentLevel');
        
        // 评估条件
        return eval(conditionExpression);
    } catch (error) {
        console.error("事件条件评估错误:", error);
        return false;
    }
}

// 应用事件效果
function applyEventEffect(event) {
    if (!event || !event.effect) {
        console.error("无效的事件或事件效果", event);
        return;
    }
    
    console.log(`应用事件效果: ${event.name}`, event);
    
    // 创建事件效果描述
    let effectDescriptions = [];
    let isNegativeEvent = false;
    let isPositiveEvent = false;
    
    // 解析并应用效果
    const effectParts = event.effect.split(',');
    effectParts.forEach(part => {
        // 修改正则表达式，使用([\u4e00-\u9fa5\w]+)匹配中文和拉丁字符
        const match = part.trim().match(/^([\u4e00-\u9fa5\w]+)([\+\-])(\d+)(%?)$/);
        if (!match) {
            console.error(`无效的事件效果格式: ${part}`);
            return;
        }
        
        const [, attribute, operation, value, isPercent] = match;
        const numValue = parseInt(value);
        
        // 根据属性名映射到实际游戏属性
        const attrMap = {
            '民心': 'peopleSupport',
            '安全': 'security',
            '文明': 'civilization',
            '资源': 'resources',
            '人口': 'population',
            '科研等级': 'researchLevel',
            '建设等级': 'constructionLevel',
            '人才等级': 'talentLevel'
        };
        
        const gameAttr = attrMap[attribute] || attribute;
        
        // 记录效果类型（正面/负面）
        if (operation === '+') isPositiveEvent = true;
        if (operation === '-') isNegativeEvent = true;
        
        // 应用效果
        if (gameState.attributes[gameAttr] !== undefined) {
            const currentValue = gameState.attributes[gameAttr];
            let newValue = currentValue;
            
            if (isPercent) {
                // 百分比变化
                const changeAmount = currentValue * (numValue / 100);
                newValue = operation === '+'
                    ? currentValue + changeAmount
                    : currentValue - changeAmount;
                
                // 添加效果描述
                effectDescriptions.push(`${attribute}${operation}${numValue}%`);
            } else {
                // 固定值变化
                newValue = operation === '+'
                    ? currentValue + numValue
                    : currentValue - numValue;
                
                // 添加效果描述
                effectDescriptions.push(`${attribute}${operation}${numValue}`);
            }
            
            gameState.attributes[gameAttr] = newValue;
            console.log(`事件效果应用: ${attribute} ${operation} ${numValue}${isPercent ? '%' : ''}, 从 ${currentValue} 变为 ${newValue}`);
        } else {
            console.error(`未知的游戏属性: ${gameAttr}, 无法应用事件效果: ${part}`);
        }
    });
    
    // 事件应用后重新进行属性范围限制
    clampAttributes();
    
    // 立即更新显示
    updateDisplays(); 
    
    // 修改日志记录方式，添加事件描述
    addLog(
        `【${event.name}】${event.description} ${effectDescriptions.join('，')}`, 
        'event'
    );
    
    // 立即检查游戏结束条件
    if (checkEnding()) {
        endGame();
    }
    
    return true; // 返回成功标志
}

// 添加格式化的事件日志
function addEventLog(title, description, effectText, eventType = '') {
    const log = document.getElementById('gameLog');
    if (!log) {
        console.error("无法找到游戏日志元素");
        return;
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry event ${eventType}`;
    
    // 添加年份信息
    const currentYear = gameState.currentYear;
    
    entry.innerHTML = `
        <span class="log-year">${currentYear}年</span>
        <div class="event-title">${title}</div>
        <div class="event-description">${description}</div>
        <span class="event-effect ${eventType}">效果: ${effectText}</span>
    `;
    
    // 插入到日志顶部
    if (log.firstChild) {
        log.insertBefore(entry, log.firstChild);
    } else {
        log.appendChild(entry);
    }
    
    // 确保事件显示可见
    entry.style.display = 'block';
    
    // 播放提示音效（如果有）
    if (eventType === 'negative') {
        playSound('warning');
    } else if (eventType === 'positive') {
        playSound('positive');
    }
    
    console.log(`事件已添加到日志: ${title}`);
}

// 播放音效（如果实现了音效系统）
function playSound(type) {
    // 这个函数是为未来扩展预留的
    // 如果实现了音效系统，可以在这里添加代码
}

// 更新人口趋势
function updatePopulationTrend() {
    const currentPopulation = gameState.attributes.population;
    const populationHistory = gameState.populationHistory;
    
    // 添加当前人口到历史记录
    populationHistory.push(currentPopulation);
    
    // 保持历史记录最多12条（近一年）
    if (populationHistory.length > 12) {
        populationHistory.shift();
    }
    
    // 如果有足够的历史数据，检查是否连续下跌
    if (populationHistory.length >= 2) {
        const isDecline = populationHistory[populationHistory.length - 1] < 
                          populationHistory[populationHistory.length - 2];
        
        if (isDecline) {
            gameState.populationDeclineYears++;
        } else {
            gameState.populationDeclineYears = 0;
        }
    }
}

// ================== 计算逻辑 ==================
function calculateYearlyChanges() {
    const attr = gameState.attributes;
    const strategy = gameState.strategies[gameState.strategy];
    gameState.lastValues = {...attr};

    // 人口变化
    const births = Math.floor(attr.population * 0.01 * gameState.birthRate * 0.1);
    const deaths = Math.max(1000, Math.ceil(attr.population * 0.01));
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

    // 先升级科研
    updateLevel('research', attr.researchConsumedTotal);
    // 再升级建设
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
    const levelConfig = gameState.levelConfig[type];
    
    if (!levelConfig || currentLevel >= levelConfig.length) {
        console.error(`无效的等级配置：${type}`);
        return;
    }

    const required = levelConfig[currentLevel];
    
    if (consumed >= required) {
        // 新增建设等级限制检查
        if (type === 'construction' && attr.researchLevel <= currentLevel) {
            addLog("⚠️ 建设等级已达到上限，请先提升科研等级！");
            return;
        }
        
        attr[`${type}Level`]++;
        addLog(`${type === 'research' ? '🔬科研' : '🏗️建设'}等级提升至 ${currentLevel + 1} 级`);
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
        attr.population <= 500 || 
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
        { condition: attr.population <= 500, info: getEnding(1) },
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
        const current = attr[`${type}Level`];
        const config = gameState.levelConfig[type] || [];
        return {
            '当前等级': current,
            '下一级需求': config[current] ? formatNumber(config[current]) : 'MAX',
            '累计消耗': formatNumber(attr[`${type}ConsumedTotal`])
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
    
    // 新增：添加随机事件调试信息
    console.groupCollapsed("随机事件系统状态");
    console.log("已加载事件数量:", gameState.events ? gameState.events.length : 0);
    
    // 显示符合当前条件的事件和它们的概率
    const availableEvents = gameState.events ? gameState.events.filter(event => checkEventCondition(event.condition)) : [];
    console.log(`符合当前条件的事件: ${availableEvents.length}个`);
    
    if (availableEvents.length > 0) {
        console.table(availableEvents.map(e => ({
            "事件名称": e.name,
            "原始概率": e.probability,
            "调整后概率": Math.min(e.probability * 10, 1),
            "事件效果": e.effect,
            "是否符合条件": true
        })));
    }
    
    if (gameState.lastTriggeredEvents && gameState.lastTriggeredEvents.length > 0) {
        console.groupCollapsed(`本年度触发的随机事件（${gameState.lastTriggeredEvents.length}个）`);
        gameState.lastTriggeredEvents.forEach((event, index) => {
            console.log(`事件 ${index + 1}:`, {
                "事件名称": event.name,
                "事件描述": event.description,
                "事件效果": event.effect,
                "事件条件": event.condition,
                "原始触发概率": event.probability,
                "调整后概率": Math.min(event.probability * 10, 1)
            });
        });
        console.groupEnd();
    } else {
        console.log("本年度未触发随机事件");
    }
    console.groupEnd();
    
    console.groupEnd();
}

// 新增：调试工具 - 手动触发随机事件
function debugTriggerRandomEvent() {
    if (!gameState.events || gameState.events.length === 0) {
        console.error("事件列表为空，无法触发随机事件");
        return null;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => {
        return checkEventCondition(event.condition);
    });
    
    if (availableEvents.length === 0) {
        console.error("没有符合当前条件的事件可触发");
        return null;
    }
    
    // 计算总概率和相对概率
    let totalProbability = 0;
    const eventsWithProbability = availableEvents.map(event => {
        const probability = Math.min(event.probability, 1);
        totalProbability += probability;
        return { ...event, adjustedProbability: probability };
    });
    
    // 确保总概率不超过1
    totalProbability = Math.min(totalProbability, 1);
    
    // 使用相对概率选择事件（轮盘赌选择法）
    let cumulativeProbability = 0;
    const selectedEventValue = Math.random() * totalProbability;
    let selectedEvent = null;
    
    for (const event of eventsWithProbability) {
        cumulativeProbability += event.adjustedProbability;
        
        if (selectedEventValue <= cumulativeProbability) {
            selectedEvent = event;
            break;
        }
    }
    
    // 如果没有选到事件（理论上不会发生），选择第一个
    if (!selectedEvent && eventsWithProbability.length > 0) {
        selectedEvent = eventsWithProbability[0];
    }
    
    console.log("调试：手动触发随机事件", selectedEvent);
    
    if (selectedEvent) {
        // 应用事件效果
        applyEventEffect(selectedEvent);
        
        // 将事件添加到本年度触发事件列表
        if (!gameState.lastTriggeredEvents) {
            gameState.lastTriggeredEvents = [];
        }
        gameState.lastTriggeredEvents.push(selectedEvent);
    }
    
    return selectedEvent;
}

// 将调试函数暴露给全局，方便控制台调用
window.debugTriggerRandomEvent = debugTriggerRandomEvent;

// 新增：检查随机事件系统的状态
function checkRandomEventSystem() {
    console.group("随机事件系统诊断");
    
    // 检查事件配置是否正确加载
    if (!gameState.events || gameState.events.length === 0) {
        console.error("错误：事件列表为空，可能是配置文件未正确加载");
        console.log("建议：检查events.json文件路径是否正确");
    } else {
        console.log(`✅ 事件列表已加载，共有${gameState.events.length}个事件`);
        
        // 检查事件格式
        let invalidEvents = [];
        gameState.events.forEach(event => {
            if (!event.name || !event.description || !event.effect || !event.probability) {
                invalidEvents.push(event);
            }
            
            // 检查事件效果格式
            if (event.effect) {
                const effectParts = event.effect.split(',');
                effectParts.forEach(part => {
                    // 使用匹配中文的正则表达式
                    const match = part.trim().match(/^([\u4e00-\u9fa5\w]+)([\+\-])(\d+)(%?)$/);
                    if (!match) {
                        console.warn(`警告：事件"${event.name}"的效果格式无效: ${part}`);
                    }
                });
            }
        });
        
        if (invalidEvents.length > 0) {
            console.warn(`警告：发现${invalidEvents.length}个格式可能不正确的事件`);
            console.table(invalidEvents);
        } else {
            console.log("✅ 所有事件格式检查通过");
        }
        
        // 检查符合当前条件的事件
        const availableEvents = gameState.events.filter(event => checkEventCondition(event.condition));
        console.log(`符合当前条件的事件: ${availableEvents.length}个`);
        
        if (availableEvents.length === 0) {
            console.warn("警告：当前没有符合条件的事件可触发");
        } else {
            console.log("✅ 有符合条件的事件可触发");
            
            // 计算总概率
            let totalProbability = 0;
            const eventsWithDetails = availableEvents.map(e => {
                const probability = Math.min(e.probability, 1);
                totalProbability += probability;
                return {
                    "事件名称": e.name,
                    "原始概率": e.probability,
                    "调整后概率": probability,
                    "事件效果": e.effect,
                    "条件": e.condition || "none"
                };
            });
            
            // 确保总概率不超过1
            totalProbability = Math.min(totalProbability, 1);
            console.log(`触发任意事件的总概率: ${totalProbability.toFixed(4)} (${(totalProbability * 100).toFixed(2)}%)`);
            console.log(`不触发任何事件的概率: ${(1-totalProbability).toFixed(4)} (${((1-totalProbability) * 100).toFixed(2)}%)`);
            
            // 显示每个事件的相对概率
            console.table(eventsWithDetails.map(e => ({
                ...e,
                "相对概率": `${((e.调整后概率 / totalProbability) * 100).toFixed(2)}%`
            })));
        }
    }
    
    // 检查最近触发的事件
    if (gameState.lastTriggeredEvents && gameState.lastTriggeredEvents.length > 0) {
        console.log(`✅ 本年度成功触发了${gameState.lastTriggeredEvents.length}个事件`);
    } else {
        console.log("本年度尚未触发任何事件");
    }
    
    console.groupEnd();
    
    return {
        eventsLoaded: gameState.events ? gameState.events.length : 0,
        availableEvents: gameState.events ? gameState.events.filter(event => checkEventCondition(event.condition)).length : 0,
        triggeredEvents: gameState.lastTriggeredEvents ? gameState.lastTriggeredEvents.length : 0,
        totalProbability: calculateTotalEventProbability()
    };
}

// 辅助函数：计算事件总概率
function calculateTotalEventProbability() {
    if (!gameState.events || gameState.events.length === 0) {
        return 0;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => checkEventCondition(event.condition));
    
    // 计算总概率
    let totalProbability = 0;
    availableEvents.forEach(event => {
        totalProbability += Math.min(event.probability, 1);
    });
    
    return Math.min(totalProbability, 1);
}

// 将诊断函数暴露给全局，方便控制台调用
window.checkRandomEventSystem = checkRandomEventSystem;

// ================== 工具提示系统 ==================
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    document.querySelectorAll('[data-tip]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        
        // 修改触摸事件处理，实现长按显示tooltip而不影响点击
        let touchTimeout;
        let isTouchMoved = false;
        
        element.addEventListener('touchstart', (e) => {
            isTouchMoved = false;
            touchTimeout = setTimeout(() => {
                if (!isTouchMoved) {
                    showTooltip(e);
                    setTimeout(hideTooltip, 2000);
                }
            }, 500); // 500ms长按阈值
        });
        
        element.addEventListener('touchmove', () => {
            isTouchMoved = true;
            clearTimeout(touchTimeout);
        });
        
        element.addEventListener('touchend', () => {
            clearTimeout(touchTimeout);
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
        "工程建设": "🏗️工程消耗+30%，安全+1/年",
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
                <p>存续时间：${totalYears}年</p>
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