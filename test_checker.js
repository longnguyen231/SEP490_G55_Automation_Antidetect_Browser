const { checkProxy } = require('./src/main/engine/proxyChecker');

async function run() {
    console.log("Testing with a dummy HTTP proxy...");
    const dummyProxy = {
        type: 'http',
        host: '1.2.3.4',
        port: 8080,
        username: '',
        password: ''
    };
    const res = await checkProxy(dummyProxy);
    console.log("Result:", res);
}

run();
