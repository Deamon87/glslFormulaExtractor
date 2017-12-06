class Ast {
    constructor (fileDump, fileName){
        this.ast = this.createJson(fileDump);
        this.fileName = fileName;
        this.assigmentArray = {};
        this.assigmentArrayCleared = {};

        this.createAssignmentArray(this.ast);
    }

    traverseTreeAndDelete(head) {
        if (head['parent']) {
            head['parent'] = undefined;
        }
        for (var i = 0; i < head['childs'].length; i++) {
            this.traverseTreeAndDelete(head['childs'][i])
        }
    }


    createJson(string) {
        var min_line = 999999
        var max_line = -1;
        var currentLevel = 0;

        var ast = {};
        var head = ast;
        head['childs'] = [];

        var lines = string.split("\n");

        for (var j = 0; j < lines.length; j ++) {
            var line = lines[j];

            // 1. Parse line number
            var lineSplit = line.split(" ");
            var possibleLineNum = lineSplit[0]
            var numberSplit = possibleLineNum.split(":")
            if (numberSplit.length != 2)
                continue;

            try {
                var someNum = parseInt(numberSplit[0]);
                var lineNumber = parseInt(numberSplit[1])
            }
            catch (e) {
                continue;
            }

            if (lineNumber < min_line)
                min_line = lineNumber;
            if (lineNumber > max_line)
                max_line = lineNumber;

            //2. Get level of string by counting spaces
            var i = possibleLineNum.length;
            var level = 0;
            while (i < line.length) {
                if (line[i] == ' ') {
                    i = i + 1;
                    level = level + 1
                }
                else
                    break;
            }

            level = Math.ceil(level / 2);
            var command = line.substr(i, line.length);
            command.replace(/\n/g, '');
            command.replace(/\r/g, '');

            //3. Parse the line
            var typepos = command.indexOf('(');
            var operand = '';
            var op_type = '';
            var vartype = '';
            if (typepos > 0) {
                operand = command.substr(0, typepos);
                op_type = command.substr(typepos + 1, command.length - typepos - 2);

                operand = operand.trim();
                op_type = op_type.trim();
            } else {
                operand = command
            }

            var vartypePos = operand.indexOf(":")

            if (vartypePos > 0 && vartypePos < operand.length-2) {
                vartype = operand.substr(vartypePos+1, operand.length);
                operand = operand.substr(0, vartypePos);
            }


            //print('lineNumber =', lineNumber, 'level =', level, 'command =', command, 'operand =', operand, 'op_type =', op_type)
            var currcommand = {'Operand': operand, 'TypeOfOp': op_type, 'vartypePos': vartypePos, 'lineNumber': lineNumber, 'childs': []};

            if (level - currentLevel == 1) {
                currcommand['parent'] = head;
                head['childs'].push(currcommand);

                head = currcommand;
                currentLevel = level
            } else if (level == currentLevel) {
                var parent = head['parent'];
                currcommand['parent'] = parent;

                parent['childs'].push(currcommand);
                head = currcommand
            } else if (level - currentLevel > 1) {
                throw "Something is wrong!";
            } else {
                var leveldiff = currentLevel - level;
                while (leveldiff > 0) {
                    head = head['parent'];
                    leveldiff = leveldiff - 1;
                }

                parent = head['parent'];
                currcommand['parent'] = parent;
                parent['childs'].push(currcommand);

                head = currcommand;
                currentLevel = level;
            }
        }

        this.traverseTreeAndDelete(ast);

        return ast;
    }

    clearVarName(val) {
        var name = val;
        name = name.replace(/'/g, '');
    
        var j = name.indexOf("_");
        if (parseInt(name.substr(j+1, name.length)) > 99) {
            name = name.substr(0, j);
        }
    
        return name;
    }


    createFormula(ast, vector) {
        if (ast.Operand == "move second child to first child") {
            return this.clearVarName(ast.childs[0].Operand) +" = " + this.createFormula(ast.childs[1]);
        } else if (ast.Operand == "direct index") {
            if (ast.childs[0].TypeOfOp == 'temp 4-component vector of float') {
                return this.extractAssignmentForVar(ast.childs[0].Operand) + "." + this.createFormula(ast.childs[1], true)
            } else if (ast.childs[0].TypeOfOp == 'temp 3-component vector of float') {
                return this.extractAssignmentForVar(ast.childs[0].Operand) + "." + this.createFormula(ast.childs[1], true)
            } else if (ast.childs[0].Operand == 'texture') {
                return this.createFormula(ast.childs[0]) + "." + this.createFormula(ast.childs[1], true)
            } else {
                return this.clearVarName(ast.childs[0].Operand) + "." + this.createFormula(ast.childs[1], true)
            }
        } else if (ast.Operand == "component-wise multiply") {
            return "(" + this.createFormula(ast.childs[0]) + ") * (" +this.createFormula(ast.childs[1])+")" ;
        } else if (ast.Operand == "dot-product") {
            return "dot(" + this.createFormula(ast.childs[0]) + "," +this.createFormula(ast.childs[1])+")" ;
        } else if (ast.Operand == "divide") {
            return "(" + this.createFormula(ast.childs[0]) + ") / (" +this.createFormula(ast.childs[1])+")" ;
        } else if (ast.Operand == "pow") {
            return "pow(" + this.createFormula(ast.childs[0]) + ", " +this.createFormula(ast.childs[1])+")" ;
        } else if (ast.Operand == "normalize") {
            return "normalize(" + this.createFormula(ast.childs[0]) + ")";
        } else if (ast.Operand == "Negate value") {
            return "-(" + this.createFormula(ast.childs[0]) + ")";
        } else if (ast.Operand == "vector-scale") {
            return "(" +this.createFormula(ast.childs[0]) + ") * (" +this.createFormula(ast.childs[1])+")";
        } else if (ast.Operand == "texture") {
            if (!ast.childs[0]) {
                console.log("error occured in ", this.fileName, JSON.stringify(ast));
            }
            return "texture(" +this.createFormula(ast.childs[0]) + "," + this.createFormula(ast.childs[1]) + ")";
        } else if (ast.Operand == "add") {
            return this.createFormula(ast.childs[0]) + " + " + this.createFormula(ast.childs[1]);
        } else if (ast.Operand == "subtract") {
            return this.createFormula(ast.childs[0]) + " - " + this.createFormula(ast.childs[1]);
        } else if (ast.Operand == "Construct vec4") {
            var result = "vec4(" +ast.childs.map((a) => {return this.createFormula(a)}).join(", ") + ")";
    
            return result;
        } else if (ast.Operand == "Construct vec3") {
            result = "vec3(" +ast.childs.map((a) => {return this.createFormula(a)}).join(", ") + ")";
    
            return result;
        } else if (ast.Operand == "mix") {
            result = "mix(" +ast.childs.map((a) => {return this.createFormula(a)}).join(", ") + ")";
    
            return result;
        } else if (ast.Operand == "clamp") {
            result = "clamp(" +ast.childs.map((a) => {return this.createFormula(a)}).join(", ") + ")";
    
    
            return result;
        } else if (ast.Operand == "vector swizzle") {
            var index = "";
            var indexes = ast.childs[1].childs;
            for (var i = 0; i < indexes.length; i++) {
                index += this.createFormula(indexes[i], true);
            }
    
            return this.createFormula(ast.childs[0]) + "." + index;
        } else if (ast.Operand == "Constant:") {
            if (vector) {
                var colors = ['r', 'g', 'b', 'a'];
                return colors[parseInt(ast.childs[0].Operand)];
            } else {
                return ast.childs[0].Operand;
            }
        } else if (ast.TypeOfOp != null) {
            return this.extractAssignmentForVar(ast.Operand)
        } else {
            console.log(JSON.stringify(ast));
        }
    
        return ""
    }

    extractAssignmentForVar(name) {
        if (name.indexOf("matDiffuse") > 0 || name.indexOf("diffTerm") > 0 || name.indexOf("envTerm") > 0 || name.indexOf("specTerm") > 0) {
            return this.clearVarName(name);
        }
        if (this.assigmentArray[name]) {
            return "(" + this.createFormula(this.assigmentArray[name]) + ")";
        } else {
            return this.clearVarName(name);
        }
    }

    escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    extractAssignmentCleraedForVar(name) {
        if (this.assigmentArrayCleared[name]) {
            return this.createFormula(this.assigmentArrayCleared[name])
                .replace(new RegExp(this.escapeRegExp("texture(pt_map0,(in_tc0))"), 'g'), "tex")
                .replace(new RegExp(this.escapeRegExp("texture(pt_map0,in_tc0)"), 'g'), "tex")
                .replace(new RegExp(this.escapeRegExp("texture(pt_map1,in_tc1)"), 'g'), "tex2")
                .replace(new RegExp(this.escapeRegExp("texture(pt_map2,in_tc2)"), 'g'), "tex3")
        } else {
            return this.clearVarName(name);
        }
    }

    createAssignmentArray(ast) {
        for (var i = 0; i < ast.childs.length; i++) {
            var sentence = ast.childs[i];
            if (sentence.Operand == "move second child to first child"){
                this.assigmentArray[sentence.childs[0].Operand] = sentence.childs[1];
    
                var operandCleared = this.clearVarName(sentence.childs[0].Operand);
                this.assigmentArrayCleared[operandCleared] = sentence;
            } else {
                this.createAssignmentArray(sentence);
            }
        }
    }
    
}

module.exports = Ast;