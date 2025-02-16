import constant from "./constant.js"

export default class LogContext {

    constructor(axiosControlPlane, pluginName) {
        this.axiosControlPlane = axiosControlPlane
        this.pluginName = pluginName
    }

    d(tag, msg) {
        this.#saveLog(tag, msg, constant.LOG_LEVEL_DEBUG)
    }

    i(tag, msg) {
        this.#saveLog(tag, msg, constant.LOG_LEVEL_INFO)
    }

    w(tag, msg) {
        this.#saveLog(tag, msg, constant.LOG_LEVEL_WARN)
    }

    e(tag, msg) {
        this.#saveLog(tag, msg, constant.LOG_LEVEL_ERROR)
    }

    #saveLog(tag, msg, level) {
        this.axiosControlPlane.post(constant.PLUGIN_LOG_URL, {
            name: this.pluginName,
            timestamp: Date.now(),
            level: level,
            tag: tag,
            log: msg
        }).then(res => {})
    }

}