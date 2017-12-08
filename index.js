const { exec } = require('child_process');
var fs = require('fs');
var es = require('event-stream')
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

var vertexshaderNames = [
    "Diffuse_T1",
    "Diffuse_Env",
    "Diffuse_T1_T2",
    "Diffuse_T1_Env",
    "Diffuse_Env_T1",
    "Diffuse_Env_Env",
    "Diffuse_T1_Env_T1",
    "Diffuse_T1_T1",
    "Diffuse_T1_T1_T1",
    "Diffuse_EdgeFade_T1",
    "Diffuse_T2",
    "Diffuse_T1_Env_T2",
    "Diffuse_EdgeFade_T1_T2",
    "Diffuse_EdgeFade_Env",
    "Diffuse_T1_T2_T1",
    "Diffuse_T1_T2_T3",
    "Color_T1_T2_T3",
    "BW_Diffuse_T1",
    "BW_Diffuse_T1_T2",
];

var outputPixelShader = [];
var outputVertexShader = [];

process.on('exit', ()=> {
    console.log(outputVertexShader.join(""))
    console.log(outputPixelShader.join(""))
});

var commandline = process.argv[2] + "glslangValidator -i ";
var shaderDir = process.argv[3];
for (let i = 0; i < pixelshaderNames.length; i++) {
    let shaderCurrDir = shaderDir + pixelshaderNames[i].toLocaleLowerCase() + "/";
    let inputFile = shaderCurrDir+'0.glsl';
    let outputFile = shaderCurrDir+'0.frag';
    let debugFile = shaderCurrDir+'0.dump';
    let firstDebugger = true;

    (function a(inputFile, outputFile, debugFile, pixelshaderName, i) {
        fs.createReadStream(inputFile).pipe(fs.createWriteStream(outputFile)).on('finish', function () {

            exec(commandline + '\"' + outputFile + '\"', (err, stdout, stderr) => {
                var debug = fs.createWriteStream(debugFile);
                debug.write(stdout);
                debug.end();

                var output = "Shader: " + pixelshaderName + '\n';
                var ast = new Ast(stdout, pixelshaderName);

                output += (ast.extractAssignmentCleraedForVar('matDiffuse')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('gammaDiffTerm')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('opacity')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('specTerm')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('final')) + '\n';
                output += ("\n");

                outputPixelShader[i] = output;
            });
        });
    })(inputFile, outputFile, debugFile, pixelshaderNames[i], i)
}

let vertexShaderDir = process.argv[4];
for (let i = 0; i < vertexshaderNames.length; i++) {
    let shaderCurrDir = vertexShaderDir + vertexshaderNames[i].toLocaleLowerCase() + "/";
    let inputFile = shaderCurrDir+'0.glsl';
    let outputFile = shaderCurrDir+'0.vert';
    let debugFile = shaderCurrDir+'0.dump';
    let firstDebugger = true;

    (function a(inputFile, outputFile, debugFile, vertexshaderName, i) {
        fs.createReadStream(inputFile)
            .pipe(es.split())                  //split stream to break on newlines
            .pipe(es.map(function (data, cb) { //turn this async function into a stream
                cb(null,
                            data.replace(new RegExp(Ast.escapeRegExp(" 0,"), 'g'), " 0.0,")
                            .replace(new RegExp(Ast.escapeRegExp(" 1)"), 'g'), " 1.0)")  + "\n"


                )
            }))
            .pipe(fs.createWriteStream(outputFile)).on('finish', function () {

            exec(commandline + '\"' + outputFile + '\"', (err, stdout, stderr) => {
                var debug = fs.createWriteStream(debugFile);
                debug.write(stdout);
                debug.end();

                var output = "Shader: " + vertexshaderName + '\n';
                var ast = new Ast(stdout, vertexshaderName);

                output += (ast.extractAssignmentCleraedForVar('localPos')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('normal')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('position')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('normPos')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('out_col0')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('out_tc0')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('out_tc1')) + '\n';
                output += (ast.extractAssignmentCleraedForVar('out_tc2')) + '\n';
                output += ("\n");

                outputVertexShader[i] = output;
            });
        });
    })(inputFile, outputFile, debugFile, vertexshaderNames[i], i)
}
