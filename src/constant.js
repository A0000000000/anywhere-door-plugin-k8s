const PLUGIN_URL = '/plugin'
const PLUGIN_CONFIG_URL = '/plugin/config'

const EVENT_DATA = 'data'

const PARAMS_NAME = 'name'
const PARAMS_TARGET = 'target'
const PARAMS_DATA = 'data'

const PLUGIN_NAME = 'plugin_name'
const AUTHORIZATION = 'Authorization'

const ERROR_CODE_SUCCESS = 0
const ERROR_CODE_NOT_THIS_PLUGIN = -1
const ERROR_CODE_TOKEN_INVALID = -2
const ERROR_CODE_UNKNOWN = -3

const ERROR_MESSAGE_SUCCESS = 'success'
const ERROR_MESSAGE_NOT_THS_PLUGIN = 'not this plugin'
const ERROR_MESSAGE_TOKEN_INVALID = 'token not valid'

const CONTROL_PLANE_BASE_REQUEST_URL = (host, port, prefix) =>  `http://${host}:${port}${prefix}`

export default {
    PLUGIN_URL,
    PLUGIN_CONFIG_URL,
    EVENT_DATA,
    PARAMS_NAME,
    AUTHORIZATION,
    PARAMS_TARGET,
    PARAMS_DATA,
    PLUGIN_NAME,
    ERROR_CODE_SUCCESS,
    ERROR_CODE_NOT_THIS_PLUGIN,
    ERROR_CODE_TOKEN_INVALID,
    ERROR_CODE_UNKNOWN,
    ERROR_MESSAGE_SUCCESS,
    ERROR_MESSAGE_NOT_THS_PLUGIN,
    ERROR_MESSAGE_TOKEN_INVALID,
    CONTROL_PLANE_BASE_REQUEST_URL
}