const { exec } = require('child_process');
var fs = require('fs');
var Ast = require('./astClass.js');



function findFunctionSequence(ast) {
    if (ast['Operand'] && ast['Operand'].indexOf('Function Definition') == 0) {
        return ast.childs[0];
    }
    for (var i = 0; i < ast.childs.length; i ++) {
        var funcSeq = findFunctionSequence(ast.childs[i]);
        if (funcSeq != null) return funcSeq;
    }
}

var pixelshaderNames = [
    "Combiners_Opaque",
    "Combiners_Mod",
    "Combiners_Opaque_Mod",
    "Combiners_Opaque_Mod2x",
    "Combiners_Opaque_Mod2xNA",
    "Combiners_Opaque_Opaque",
    "Combiners_Mod_Mod",
    "Combiners_Mod_Mod2x",
    "Combiners_Mod_Add",
    "Combiners_Mod_Mod2xNA",
    "Combiners_Mod_AddNA",
    "Combiners_Mod_Opaque",
    "Combiners_Opaque_Mod2xNA_Alpha",
    "Combiners_Opaque_AddAlpha",
    "Combiners_Opaque_AddAlpha_Alpha",
    "Combiners_Opaque_Mod2xNA_Alpha_Add",
    "Combiners_Mod_AddAlpha",
    "Combiners_Mod_AddAlpha_Alpha",
    "Combiners_Opaque_Alpha_Alpha",
    "Combiners_Opaque_Mod2xNA_Alpha_3s",
    "Combiners_Opaque_AddAlpha_Wgt",
    "Combiners_Mod_Add_Alpha",
    "Combiners_Opaque_ModNA_Alpha",
    "Combiners_Mod_AddAlpha_Wgt",
    "Combiners_Opaque_Mod_Add_Wgt",
    "Combiners_Opaque_Mod2xNA_Alpha_UnshAlpha",
    "Combiners_Mod_Dual_Crossfade",
    "Combiners_Opaque_Mod2xNA_Alpha_Alpha",
    "Combiners_Mod_Masked_Dual_Crossfade",
    "Combiners_Opaque_Alpha",
    "Guild",
    "Guild_NoBorder",
    "Guild_Opaque",
    "Combiners_Mod_Depth",
    "Illum",
    "Combiners_Mod_Mod_Mod_Const"
];

var vertexshaderNames = [];
var outputPixelShader = [];

process.on('exit', ()=> { console.log(outputPixelShader.join(""))});

var commandline = process.argv[2] + "glslangValidator -i ";
var shaderDir = process.argv[3];
for (var i = 0; i < pixelshaderNames.length; i++) {
    var shaderCurrDir = shaderDir + pixelshaderNames[i].toLocaleLowerCase() + "/";
    var inputFile = shaderCurrDir+'0.glsl';
    var outputFile = shaderCurrDir+'0.frag';
    var debugFile = shaderCurrDir+'0.dump';
    var firstDebugger = true;

    (function a(inputFile, outputFile, debugFile, pixelshaderName, i) {
        fs.createReadStream(inputFile).pipe(fs.createWriteStream(outputFile)).on('finish', function () {

            exec(commandline + '\"' + outputFile + '\"', (err, stdout, stderr) => {
                var debug = fs.createWriteStream(debugFile);
                debug.write(stdout);
                debug.end();

                var output = "Shader: " + pixelshaderName + '\n';
                var ast = new Ast(stdout, pixelshaderName);

                output += (ast.extractAssignmentCleraedForVar('matDiffuse')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('diffTerm')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('specTerm')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('final')) + '\n';
                output += ("\n");

                outputPixelShader[i] = output;
            });
        });
    })(inputFile, outputFile, debugFile, pixelshaderNames[i], i)
}
