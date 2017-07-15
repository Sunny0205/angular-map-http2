const Utility = require('../lib/commonMethod');
const Comm = Utility.Comm;
const queryFormat = function (query, values) {
  if (!values) return query;
  return query.replace(/\:(\w+)/g, function (txt, key) {
    if (values.hasOwnProperty(key)) {
      return this.escape(values[key]);
    }
    return txt;
  }.bind(this));
};

class dealbusiness {
  constructor(DbHelper) {
    this.DbHelper = DbHelper;
  }

  Process(Request, Response, Options) {
    // Response.Send("ok");
    const { methodInfo } = Options;
    const { pathname, method } = methodInfo;
    const sql = Comm.format("select * from sys_rule t where t.status = 1 and t.PathName = '{0}' and t.Method = '{1}'",
      pathname, method);
    const __self = this;
    this.DbHelper.QueryOne(sql, (data) => {
      const { result } = data;
      if (result) {
        __self.__ProcessRule(Request, Response, Options, result);
      } else {
        Response.SendError({ code: 404, msg: '方法没有找到' });
      }
    }, (err) => {
      Response.SendError({ code: 404, msg: '方法没有找到' });
    });
  }

  __CheckFields(fields, params) {
    if (fields === "") {
      return true;
    }
    let notExistsFields = [];
    fields.split(',').forEach((field) => {
      if (!params[field]) {
        notExistsFields.push(field);
      }
    });
    if (notExistsFields.length === 0) {
      return true;
    }
    this.__NotExistsFields = notExistsFields;
    return false;
  }

  __ProcessRule(Request, Response, Options, RuleInfo) {
    // 开始处理规则
    const { Content } = RuleInfo;
    const RuleContent = JSON.parse(Content);
    console.log(JSON.stringify(RuleContent));
    const { rules, fields, result } = RuleContent;
    const { data, params } = Options;
    const __CheckedParams = Object.assign({}, data, params);
    if (!this.__CheckFields(fields, __CheckedParams)) {
      Response.SendError({ code: 400, msg: '参数错误,少传[' + this.__NotExistsFields.join(',') + ' ]字段' });
      return;
    }

    const __first = rules.shift();
    const __self = this;
    this.__Rules(__first, rules, Object.assign({}, data, params, { Result: {} }), (success) => {
      const { Result } = success;
      // 组织结果
      const __Data = __self.__ResultInfo(result, success);
      Response.Send(__Data);
    });
  }

  __Rules(Rule, RuleCollection, Options, Complete) {
    const { id, type, sql, isRows, name, resultName } = Rule;
    console.log('id-->', id);
    const _t = (type || 'query').toLocaleLowerCase();
    const _FormatSQL = queryFormat(sql, Options);
    const _NextRule = RuleCollection.shift();
    const __Next = () => {
      if (_NextRule) {
        this.__Rules(_NextRule, RuleCollection, Options, Complete);
      } else {
        Complete(Options);
      }
    };
    switch (_t) {
      case 'query':
        if (isRows) {
          this.DbHelper.Query(_FormatSQL, (data) => {
            const { result } = data;
            Options.Result[id] = { __name: name, result };
            __Next();
          }, () => { });
        } else {
          this.DbHelper.QueryOne(_FormatSQL, (data) => {
            const { result } = data;
            Options.Result[id] = { __name: name, result };
            __Next();
          }, () => { });
        }
        break;
      case 'insert':
        this.DbHelper.InsertSQL(_FormatSQL, (data) => {
          const { result } = data;
          if (resultName && resultName !== '') {
            const __InsertResultInfo = {};
            __InsertResultInfo[resultName] = result.insertId;
            Object.assign(Options, __InsertResultInfo);
          }
          __Next();
        }, () => { });
        break;
      case 'delete':
        this.DbHelper.DeleteSQL(_FormatSQL, (data) => {
          __Next();
        }, () => { });
        break;
      case 'update':
        this.DbHelper.UpdateSQL(_FormatSQL, (data) => {
          __Next();
        }, () => { });
        break;
    }

  }

  __ResultInfo(ResultNo, Options) {
    const { Result } = Options;
    const __ResultNoInfo = Result[ResultNo];
    if (__ResultNoInfo) {
      const __Info = __ResultNoInfo.result;
      delete __Info.__name;
      delete Result[ResultNo];

      Object.values(Result).forEach((value) => {
        const { __name, result } = value;
        __Info[__name] = result;
      });

      return __Info;
    }
    return Object.values(__Result)[0];
  }

}

module.exports = dealbusiness;