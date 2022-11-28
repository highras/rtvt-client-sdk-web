window.AudioHelper=(typeof AudioHelper==="undefined")?{}:AudioHelper;

const AudioHelperResult = {
    AHR_CODE_OK: 0,  // 成功
    AHR_CODE_WAITING_PERMISSION: 1,  // 等待授权
    AHR_CODE_NO_PERMISSION: 2,  // 无麦克风权限
    AHR_CODE_NOT_SUPPORT: 3,  // 浏览器不支持
};

AudioHelper.mergeBuffers = function(recBuffers, recLength) {
  var result = new Float32Array(recLength);
  var offset = 0;
  for (var i = 0; i < recBuffers.length; i++) {
      result.set(recBuffers[i], offset);
      offset += recBuffers[i].length;
  }
  return result;
}

AudioHelper.success = function(e) {
    AudioHelper.stream = e;

    if (!AudioHelper.allowed) {
        AudioHelper.allowed = true;
        AudioHelper.startCallback(AudioHelperResult.AHR_CODE_OK);
    }

    var AudioContext = window.AudioContext || window.webkitAudioContext;
    AudioHelper.audioContext = new AudioContext({sampleRate:16000});
    
    AudioHelper.audioInput = AudioHelper.audioContext.createMediaStreamSource(e);
    AudioHelper.sampleRate = AudioHelper.audioInput.context.sampleRate;

    let bufferSize = 1024;
    let maxBufferSize = 10;

    AudioHelper.recorder = (AudioHelper.audioInput.context.createScriptProcessor || 
        AudioHelper.audioInput.context.createJavaScriptNode).call(AudioHelper.audioInput.context, bufferSize, 1, 1);

    AudioHelper.recorder.onaudioprocess = function(e) {
        let samples = e.inputBuffer.getChannelData(0);
        let samplesCopy = samples.slice(0);

        if (AudioHelper.buffer.length > bufferSize * maxBufferSize) {
            AudioHelper.buffer = AudioHelper.buffer.slice(0 - bufferSize * maxBufferSize);
        }

        for (let i = 0; i < samplesCopy.length; i++) {
            AudioHelper.buffer.push(samplesCopy[i]);
        }

        let maxOutputSize = 320;
        let length = AudioHelper.buffer.length;
        if (length < maxOutputSize) {
            return;
        }

        let size = parseInt(length / maxOutputSize);
        for (var sizeIndex = 0; sizeIndex < size; sizeIndex++) {
            var output = new ArrayBuffer(maxOutputSize * 2);
            var view = new DataView(output);
            var offset = 0;

            var sum = 0;
            for (var index = sizeIndex * maxOutputSize; index < sizeIndex * maxOutputSize + maxOutputSize; index++) {
                var s = Math.max(-1, Math.min(1, AudioHelper.buffer[index]))
                let int16Val = s < 0 ? s * 0x8000 : s * 0x7FFF;
                sum += Math.abs(int16Val);
                view.setInt16(offset, int16Val, true);
                offset += 2;
            }
            db = parseInt(Math.log10(sum / maxOutputSize));
            if (db > 0) {
                AudioHelper.callback(output);
            }
        }

        var newBuffer = [];
        var offset = 0;
        for (var index = size * maxOutputSize; index < AudioHelper.buffer.length; index++) {
            newBuffer[offset++] = AudioHelper.buffer[index];
        }
        AudioHelper.buffer = newBuffer;
    }

    AudioHelper.audioInput.connect(AudioHelper.recorder);
    AudioHelper.recorder.connect(AudioHelper.audioInput.context.destination);
}

AudioHelper.stopMicrophoneCapture = function() {
    AudioHelper.recorder.disconnect();
    AudioHelper.stream.getTracks().forEach(function(track) {
        track.stop();
    });
}

AudioHelper.startMicrophoneCapture = function(startCallback, dataCallback) {
    AudioHelper.callback = dataCallback;
    AudioHelper.startCallback = startCallback;
    AudioHelper.buffer = [];

    if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                sampleSize: 16,
                channelCount: 1,
                volume: 2.0,
                noiseSuppression: true,
            }
        }).then(AudioHelper.success).catch(function(error) {
            startCallback(AudioHelperResult.AHR_CODE_NO_PERMISSION);
        });
        AudioHelper.allowed = false;
        startCallback(AudioHelperResult.AHR_CODE_WAITING_PERMISSION);
    } else {
        startCallback(AudioHelperResult.AHR_CODE_NOT_SUPPORT);
    }

}