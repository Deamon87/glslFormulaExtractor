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


    //GLSL Operator precedence: http://learnwebgl.brown37.net/12_shader_language/glsl_mathematical_operations.html
    createFormula(ast, prevPriority, vector) {
        var result;
        var newPriority = prevPriority;

        switch (ast.Operand) {
            case "Sequence":
                newPriority = 17;
                result = ast.childs.map((a) => {return this.createFormula(a, newPriority, vector)}).join(", ");
                break;

            case "move second child to first child":
                newPriority = 16;
                result = this.clearVarName(ast.childs[0].Operand) +" = " + this.createFormula(ast.childs[1], newPriority);
                break;

            case "direct index":

                // if (ast.childs[0].TypeOfOp == 'temp 4-component vector of float') {
                //     result = this.extractAssignmentForVar(ast.childs[0].Operand) + "." + this.createFormula(ast.childs[1], 1, true)
                // } else if (ast.childs[0].TypeOfOp == 'temp 3-component vector of float') {
                //     result = this.extractAssignmentForVar(ast.childs[0].Operand) + "." + this.createFormula(ast.childs[1], 1, true)
                // } else if (ast.childs[0].Operand == 'texture') {
                //
                // } else {
                //     result = this.createFormula(ast.childs[0], 1) + "." + this.createFormula(ast.childs[1], 0, true)
                // }

                newPriority = 2;
                if (
                    ast.childs[0].TypeOfOp && ast.childs[0].TypeOfOp.indexOf("array") >= 0 ||
                    ast.childs[0].TypeOfOp && ast.childs[0].TypeOfOp.indexOf("matrix") >= 0
                ) {
                    result = this.createFormula(ast.childs[0], newPriority) + "[" + this.createFormula(ast.childs[1], newPriority)+"]";
                } else {
                    result = this.createFormula(ast.childs[0], newPriority) + "." + this.createFormula(ast.childs[1], newPriority, true);
                }

                break;
            case "vector swizzle":
                newPriority = 2;
                var index = "";
                var indexes = ast.childs[1].childs;
                for (var i = 0; i < indexes.length; i++) {
                    index += this.createFormula(indexes[i], newPriority, true);
                }

                result = this.createFormula(ast.childs[0], newPriority) + "." + index;
                break;


            case "Convert double to float":
                result = this.createFormula(ast.childs[0], prevPriority);
                break;
            case "Convert float to double":
                result = this.createFormula(ast.childs[0], prevPriority);
                break;

            case "divide":
                newPriority = 4;
                result = this.createFormula(ast.childs[0], newPriority) + "/" +this.createFormula(ast.childs[1], newPriority);
                break;
            case "component-wise multiply":
                newPriority = 4;
                result = this.createFormula(ast.childs[0], newPriority) + " * " +this.createFormula(ast.childs[1], newPriority);
                break;
            case "vector-times-matrix":
                newPriority = 4;
                result = this.createFormula(ast.childs[0], newPriority) + " * " +this.createFormula(ast.childs[1], newPriority);
                break;
            case "vector-scale":
                newPriority = 4;
                result = this.createFormula(ast.childs[0], newPriority) + " * " +this.createFormula(ast.childs[1], newPriority);
                break;

            case "Negate value":
                newPriority = 3;
                result = result = "-" + this.createFormula(ast.childs[0], newPriority) ;
                break;

             case "add":
                newPriority = 5;
                result = this.createFormula(ast.childs[0], newPriority) + " + " + this.createFormula(ast.childs[1], newPriority);
                break;

            case "subtract":
                newPriority = 5;
                result = this.createFormula(ast.childs[0], newPriority) + " - " + this.createFormula(ast.childs[1], newPriority);
                break;

            case "Constant:":
                if (vector) {
                    var colors = ['r', 'g', 'b', 'a'];
                    result = ast.childs.map((a) => {return colors[parseInt(a.Operand)]}).join(", ");
                } else {
                    result = ast.childs.map((a) => {return a.Operand}).join(", ");
                }
                break;

            // Function calls

            case "Construct vec3":
                newPriority = 2;
                result = "vec3(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;
            case "Construct mat3":
                newPriority = 2;
                result = "mat3(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;
            case "Construct mat4":
                newPriority = 2;
                result = "mat4(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;

            case "Construct vec4":
                newPriority = 2;
                result = "vec4(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;

            case "mix":
                newPriority = 2;
                result = "mix(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;

            case "clamp":
                newPriority = 2;
                result = "clamp(" +ast.childs.map((a) => {return this.createFormula(a, 99)}).join(", ") + ")";
                break;

            case "pow":
                newPriority = 2;
                result = "pow(" + this.createFormula(ast.childs[0], 99) + ", " +this.createFormula(ast.childs[1], 99)+")" ;
                break;
            case "normalize":
                newPriority = 2;
                result = "normalize(" + this.createFormula(ast.childs[0], 99) + ")";
                break;

            case "sqrt":
                newPriority = 2;
                result = "sqrt(" + this.createFormula(ast.childs[0], 99) + ")";
                break;

            case "texture":
                newPriority = 2;
                if (!ast.childs[0]) {
                    console.log("error occured in ", this.fileName, JSON.stringify(ast));
                }
                result = "texture(" +this.createFormula(ast.childs[0], 99) + "," + this.createFormula(ast.childs[1], 99) + ")";
                break;

            case "dot-product":
                newPriority = 2;
                result = "dot(" + this.createFormula(ast.childs[0], 99) + "," +this.createFormula(ast.childs[1], 99)+")" ;
                break;

            default:
                if (ast.TypeOfOp != null) {
                    result = this.extractAssignmentForVar(ast.Operand, prevPriority)
                } else {
                    console.log(JSON.stringify(ast));
                }
            break;
        }

        if (newPriority > prevPriority) {
            result = "(" + result + ")";
        }

        return result;
    }

    extractAssignmentForVar(name, prevPriority) {
        if (name.indexOf("matDiffuse") > 0
            || name.indexOf("diffTerm") > 0
            || name.indexOf("envTerm") > 0
            || name.indexOf("specTerm") > 0
            || name.indexOf("opacity") > 0
            || name.indexOf("gammaDiffTerm") > 0
            || name.indexOf("localPos") > 0
            || name.indexOf("normal") > 0
            || name.indexOf("position") > 0
            || name.indexOf("normPos") > 0
            || name.indexOf("pc_genericParams") > 0) {
            return this.clearVarName(name);
        }
        var result;
        if (this.assigmentArray[name]) {
            result = this.createFormula(this.assigmentArray[name], prevPriority);
            //HACK
            if (result == "(normPos - normal * 2.000000 * dot(normPos,normal))") {
                result = "reflect(normPos, normal)";
            }
            return result;
        } else {
            return this.clearVarName(name);
        }
    }

    static escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    extractAssignmentCleraedForVar(name) {
        if (this.assigmentArrayCleared[name]) {
            return this.createFormula(this.assigmentArrayCleared[name]);
                // .replace(new RegExp(this.escapeRegExp("texture(pt_map0,(in_tc0))"), 'g'), "tex")
                // .replace(new RegExp(this.escapeRegExp("texture(pt_map0,in_tc0)"), 'g'), "tex")
                // .replace(new RegExp(this.escapeRegExp("texture(pt_map1,in_tc1)"), 'g'), "tex2")
                // .replace(new RegExp(this.escapeRegExp("texture(pt_map2,in_tc2)"), 'g'), "tex3")
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



// Shader: Combiners_Mod_AddAlpha_Alpha
// matDiffuse = ((in_col0.rgb) * (2.000000)) * ((tex).rgb)
// gammaDiffTerm = (matDiffuse) * (vec3((1.000000)))
// opacity = (((tex).a) + (((tex2).a)) * (((0.300000) * ((tex2).r) + (0.590000) * ((tex2).g) + (0.110000) * ((tex2).b)))) * (in_col0.a)
// specTerm
// final = ((((vec4(sqrt((((matDiffuse) * (vec3((1.000000))))) * (((matDiffuse) * (vec3((1.000000)))))) + (((tex2).rgb) * (((tex2).a))) * (1.000000 - ((tex).a)), ((((((tex).a) + (((tex2).a)) * (((0.300000) * ((tex2).r) + (0.590000) * ((tex2).g) + (0.110000) * ((tex2).b)))) * (in_col0.a))) * (pc_visParams.r)))))))
