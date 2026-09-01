[CmdletBinding()]
param(
  [string]$Output = '',
  [int]$Iterations = 5,
  [int]$WorkloadSize = 36,
  [string]$NodeWorkload = 'acorn_node_workload.cjs',
  [string]$ControlWorkload = 'acorn_control_workload.cjs'
)

. (Join-Path $PSScriptRoot 'step_common.ps1')
$Output = Resolve-LabOutput $Output
$stage = New-LabStage
try {
  $nodeExe = (Get-Command node).Source
  $nodeScript = Resolve-LabStageExample $stage $NodeWorkload
  $controlScript = Resolve-LabStageExample $stage $ControlWorkload
  $jitRun = Invoke-LabProcess $nodeExe @($nodeScript, [string]$Iterations, [string]$WorkloadSize) $stage
  $jitlessRun = Invoke-LabProcess $nodeExe @('--jitless', $nodeScript, [string]$Iterations, [string]$WorkloadSize) $stage
  $controlRun = Invoke-LabProcess $nodeExe @($controlScript, [string]$Iterations, [string]$WorkloadSize) $stage
  $jit = ConvertFrom-LabJsonLine $jitRun.Stdout
  $jitless = ConvertFrom-LabJsonLine $jitlessRun.Stdout
  $control = ConvertFrom-LabJsonLine $controlRun.Stdout
  $sameSemanticResult = ($jit.checksum -eq $jitless.checksum) -and
    ($jit.node_count -eq $jitless.node_count) -and ($jit.source_bytes -eq $jitless.source_bytes)
  if (-not $sameSemanticResult) { throw 'JIT and jitless produced different semantic results.' }
  $result = [ordered]@{
    step = 2
    purpose = 'Verify that experiment and control workloads are comparable.'
    iterations = $Iterations
    workload_size = $WorkloadSize
    node_workload = $NodeWorkload
    control_workload = $ControlWorkload
    jit = $jit
    jitless = $jitless
    control = $control
    jit_and_jitless_same_semantics = $sameSemanticResult
    control_skips_workload = ($control.node_count -eq 0)
    control_skips_parser = ($control.node_count -eq 0)
    interpretation = 'Matching JIT/jitless outputs prove equivalent semantics; control node_count=0 proves that it skips the measured core operation.'
  }
  $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Output 'step-02-workload-verification.json') -Encoding utf8
  $result | ConvertTo-Json -Depth 6
} finally {
  Remove-LabStage $stage
}
