const appck = process.env.APP_COOKIE
const axios = require("axios");
const validIds = [
    {
        "name": '测试',
        "is_active": 1,
        "startTime": '00:00:00',
        "couponId": 'BEA9D26AEBD64F9A9680FE390A05654B',
        "intervalTime": 100,
        "gdId": "483094",
        "pageId": "484474",
        "instanceId": "16819754696590.74922283078048070"
    },
    {
        "name": '25-12(11点)',
        "is_active": 1,
        "startTime": '11:00:00',
        "couponId": '687D57731F804A2CAE1F455331F83524',
        "intervalTime": 100,
        "gdId": "379391",
        "pageId": "378925",
        "instanceId": "16619982800580.30892480633143027"
    },
    {
        "name": '25-12(15点)',
        "is_active": 1,
        "startTime": '15:00:00',
        "couponId": '35D2E964BB334BEF9239151847DACC02',
        "intervalTime": 100,
        "gdId": "513833",
        "pageId": "516533",
        "instanceId": "16890429573560.08766758935246644"
    },
    {
        "name": '25-12(17点)',
        "is_active": 1,
        "startTime": '17:00:00',
        "couponId": '419967B3A4064140BA78E6A046DF0FC1',
        "intervalTime": 100,
        "gdId": "379391",
        "pageId": "378925",
        "instanceId": "16619982800580.30892480633143027"
    }
];

if (process.env.testTime !== undefined) {
    if (process.env.testTime == 0) {
        validIds[0].startTime = new Date(new Date().getTime() + 60000).toTimeString().split(' ')[0];
        console.log("开启测试模式，测试时间为当前时间的下一分钟" + validIds[0].startTime)
    }
}

const repeat = 20  // 抢券默认请求次数(默认生成20条),

let offsetTime = 0  // 本地与美团平台时间戳偏移量
const syncTime = 3000  // 提前3s再次同步时间
const ticketingTime = 500  // 抢券提前时间提前500ms
const signTime = 10000  // sign生成时间（提前10s）


// 筛选符合场次时间的内容
function getValidIds() {
    //用于存储符合条件的有效优惠券场次
    let validElement = null;
    let minDifference = Infinity;
    const currentTime = new Date().getTime(); // 获取当前时间的时间戳

    for (const element of validIds) {
        const startTime = new Date(new Date().toDateString() + ' ' + element.startTime).getTime(); // 将 startTime 转换为时间戳

        if (startTime >= currentTime && startTime - currentTime < minDifference) {
            minDifference = startTime - currentTime;
            validElement = element;
        }
    }
    return validElement
}


//睡眠，请求间隔时间
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

//获取服务器时间
async function getServerTime() {
    const url = 'https://cube.meituan.com/ipromotion/cube/toc/component/base/getServerCurrentTime';
    try {
        const startTime = Date.now(); // 记录开始时间
        const response = await axios.get(url, {timeout: 1000}); // 设置1s超时
        const endTime = Date.now(); // 记录结束时间
        const latency = endTime - startTime; // 计算延迟时间
        if (response.status === 200 && response.data.hasOwnProperty('data')) {
            const serverTime = response.data.data + latency; // 服务器时间 + 延迟时间
            return serverTime;
        } else {
            return Date.now();
        }
    } catch (error) {
        console.error("getServerTime:", error.message);
        return Date.now();
        // throw error;
    }
}

// 同步本地时间戳（设置偏移量）
async function syncLocalTimestamp() {
    try {
        const serverTime = await getServerTime();
        const localTimestamp = Date.now(); // 获取本地时间戳
        offsetTime = serverTime - localTimestamp;
        console.log(`同步时间：${offsetTime}ms`);
        // return offsetTime; // 返回结果
    } catch (error) {
        console.error('调用 getServerTime 发生错误:', error.message);
        // throw error;
    }
}

//  获取同步后本地时间戳
const getTimestamp = async () => {
    return Date.now() + offsetTime;
};

//检查登录状态，通过get方式刷新cookie，解决不同场次cookie不通用问题
async function checkLoginStatus(couponObj, cookie) {
    const couponId = couponObj.couponId
    const infoUrl = `https://promotion.waimai.meituan.com/lottery/limitcouponcomponent/info?couponReferIds=${couponId}`;
    try {
        const response = await axios.get(infoUrl, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 9; MI 6 Build/PKQ1.190118.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.99 XWEB/3263 MMWEBSDK/201201 Mobile Safari/537.36 MMWEBID/7685 MicroMessenger/8.0.1.1840(0x2800013B) Process/appbrand0 WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 miniProgram',
                "Cookie": cookie,
            },
        });

        if (response.status === 200 && response.data.msg.includes("成功")) {
            return true;
        } else {
            console.log(`cookie失效：${response.data.msg}`);
            return false;
        }
    } catch (error) {
        console.error(`登录状态异常-> ${error.message}`);
        return false;
    }
}

// 生成签名
async function generateSign(cookie, url, signDataArr) {
    const signApi = "https://mt.500error.cn/sign";
    const headers = {
        "Host": "promotion.waimai.meituan.com",
        "Connection": "keep-alive",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://market.waimai.meituan.com",
        "mtgsig": {},
        "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
        "Content-Type": "application/json",
        "Referer": "https://market.waimai.meituan.com/",
        "Accept-Encoding": "gzip, deflate",
        "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cookie": cookie
    };
    const data = {
        "url": url,
        "cookie": cookie,
        "userAgent": headers["User-Agent"],
        "data": {"cType": "wx_wallet", "fpPlatform": 13, "wxOpenId": "", "appVersion": ""}
    };
    // const userAgent = headers["User-Agent"];
    try {
        const response = await axios.post(signApi, data, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
            },
        });

        if (response.status === 200 && response.data.hasOwnProperty('data')) {
            //补全参数
            headers.mtgsig = response.data.data.mtgsig;
            data.data["mtFingerprint"] = response.data.data.mtFingerprint;
            const jsonData = data.data
            const dataObj = {jsonData, headers}
            signDataArr.push(dataObj)

        } else {
            console.log("请求失败:", response.status);
            return
        }
    } catch (error) {
        console.error(`请求错误: ${error.message}`);
        return
    }
    //返回数据
    return signDataArr
}


//定时抢券任务
async function postTask(couponObj, cookie) {
    // 抢券url
    const url = `https://promotion.waimai.meituan.com/lottery/limitcouponcomponent/fetchcoupon?couponReferId=${couponObj.couponId}&geoType=2&gdPageId=${couponObj.gdId}&pageId=${couponObj.pageId}&version=1&utmSource=AppStore&utmCampaign=AgroupBgroupD0H0&instanceId=${couponObj.instanceId}&componentId=${couponObj.instanceId}`;
    // 每次抢券请求间隔时间
    const intervalTime = couponObj.intervalTime;
    const makeRequest = async function (url, data, headers, lastPost) {
        try {
            const response = await axios.post(url, data, {headers});
            if (response.status === 200 && response.data.hasOwnProperty('msg')) {
                console.log(response.data.msg)
                if (response.data.msg.includes("成功") || response.data.msg.includes("已")) {
                    console.log(`${couponObj.name}: ${response.data.msg}`);
                }
                //最后一次post请求、没券、异常则停止抢券
                if (lastPost || response.data.msg.includes("来晚了") || response.data.msg.includes("异常")) {
                    console.log(`${couponObj.name}-> msg:${response.data.msg}`);
                }
            } else {
                //这里随便了，状态码403直接到error
                console.log(`${couponObj.name}-> 抢券失败，状态码：${response.status}`);
            }
            // console.log(response.data); // 输出响应数据
        } catch (error) {
            console.log(`${couponObj.name}-> 请求错误: ${error.message}`);
        }
    };

    //计算当前时间与开始时间的时间差
    const idStartTimeStamp = new Date(new Date().toDateString() + ' ' + couponObj.startTime).getTime(); //获取id的开始时间戳（13位）
    let nowTimeStamp = await getTimestamp();  // 获取当前时间戳(同步后的)
    const startTimestamp = idStartTimeStamp - ticketingTime;  // 开始抢券时间(id开始时间 - 提前时间)
    const signTimeStamp = startTimestamp - signTime;  //sign生成时间( 开始抢券时间 - signTime )
    const syncTimeStamp = startTimestamp - syncTime;  // 再次同步时间( 开始抢券时间 - syncTime )

    //存放sign数据
    const signDataArray = [];

    // 暂停到应该执行任务的时间
    let diffMs = startTimestamp - nowTimeStamp;
    let count = 0;  //同步次数
    console.log(`${couponObj.name}-> 正在等待抢券中...`)
    while (diffMs > 0) {
        // sign生成
        if (nowTimeStamp >= signTimeStamp && signDataArray.length < repeat) {
            console.log(`开始生成sign...`);
            //这个for循环要不要都行， 为了方便信息输出，还是写了
            for (let i = 0; i < repeat; i++) {
                await generateSign(cookie, url, signDataArray);
            }
            console.log(`共生成: ${signDataArray.length}条`);
            console.log(`${couponObj.name}-> 继续等待抢券...`)
        }
        // 同步时间，减少误差(2)
        if (nowTimeStamp >= syncTimeStamp && count < 2) {
            await syncLocalTimestamp();
            count += 1;
        }

        //更新时间
        nowTimeStamp = Date.now()  // 获取时间戳
        diffMs = startTimestamp - nowTimeStamp

    }
    // 开始抢券
    // console.log(`${couponObj.name}-> 开始抢券：${moment(nowTimeStamp).format('YYYY-MM-DD HH:mm:ss.SSS')}`)
    console.log(`${couponObj.name}-> 开始抢券：${new Date().toDateString()}`)
    let lastPost = false; // 是否是最后一次请求
    for (let i = 0; i < signDataArray.length; i++) {
        const startTime = Date.now(); // 获取请求开始时间
        if (i === signDataArray.length - 1) {
            // 最后一次请求
            lastPost = true;
        }
        await makeRequest(url, signDataArray[i].jsonData, signDataArray[i].headers, lastPost);
        const endTime = Date.now(); // 获取请求结束时间
        const elapsedTime = endTime - startTime; // 计算请求时间
        const sleepTime = Math.max(0, intervalTime - elapsedTime); // 排除延迟波动干扰，正确间隔时间
        await sleep(sleepTime); // 请求间隔（在config.json设置）
    }

}

// 主函数
async function main(cookie) {
    try {

        // 获取符合场次的内容
        const validIds = getValidIds();
        if (!validIds) {
            console.log("没有符合当前时间的场次");
            return;
        }

        // 获取单个cookie

        //检测状态和刷新cookie场次
        const loginStatus = await checkLoginStatus(validIds, cookie);
        if (!loginStatus) {
            return;
        }

        //抢券任务
        postTask(validIds, cookie)


    } catch (error) {
        console.error('MainError:', error.message);
    }
}

console.log("脚本作者：那个老头对你好吗")
console.log("脚本版本：v1.0.0")
console.log("接口作者：一位不愿透露姓名的大佬(***)*号代替了")
console.log("算法作者：宝宝巴士")
console.log("脚本说明：本脚本仅供学习交流使用，禁止用于商业用途，否则后果自负！")
console.log("脚本内置 25-12 优惠券场次，可自行添加其他场次，具体方法请参考脚本内注释！")
console.log("其中 25-12 时间为 11:00:00、15:00:00、17:00:00")
console.log("建议提前3分钟运行脚本，防止网络延迟等问题导致抢券失败！")
console.log("开始抢券...")
main(appck);