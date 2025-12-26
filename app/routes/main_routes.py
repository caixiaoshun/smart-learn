from flask import Blueprint, render_template, redirect, url_for, request, jsonify, current_app
from flask_login import login_required, current_user
import os

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.course_home'))
    return redirect(url_for('auth.login'))

@bp.route('/course')
@login_required
def course_home():
    return render_template('course_home.html')

@bp.route('/resources')
@login_required
def resources():
    return render_template('resources.html')

@bp.route('/settings')
@login_required
def settings():
    return render_template('settings.html')

@bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@bp.route('/teacher/assignments')
@login_required
def teacher_assignments():
    return render_template('teacher_assignments.html')

@bp.route('/teacher/behavior')
@login_required
def teacher_behavior():
    return render_template('teacher_behavior.html')

@bp.route('/ai-assistant')
@login_required
def ai_assistant():
    return render_template('ai_assistant.html')

@bp.route('/case-studies')
@login_required
def case_studies():
    return render_template('case_studies.html')

@bp.route('/api/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    user_message = data.get('message')

    # Mock AI Logic - check for API Key in real scenario
    ai_api_key = current_app.config.get('AI_API_KEY')

    if ai_api_key:
        try:
            import requests
            # Use standard OpenAI-compatible API format
            # This allows usage with OpenAI, Azure OpenAI, or self-hosted LLMs (e.g. vLLM, Ollama)
            # Default to OpenAI if not specified
            api_base = os.environ.get('AI_API_ENDPOINT', 'https://api.openai.com/v1')

            headers = {
                "Authorization": f"Bearer {ai_api_key}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "gpt-3.5-turbo", # Default model, could be env var
                "messages": [
                    {"role": "system", "content": "You are a helpful education assistant named EduBot."},
                    {"role": "user", "content": user_message}
                ],
                "temperature": 0.7
            }

            response = requests.post(f"{api_base}/chat/completions", json=payload, headers=headers, timeout=10)

            if response.status_code == 200:
                bot_reply = response.json()['choices'][0]['message']['content']
            else:
                bot_reply = f"Error from AI Provider: {response.status_code} - {response.text}"
        except Exception as e:
            bot_reply = f"System Error: {str(e)}"
    else:
        # Mock responses
        if "干预" in user_message or "intervention" in user_message:
            bot_reply = "根据您的班级数据，建议针对'张伟'和'李娜'进行基础知识巩固干预。您可以为他们布置针对性的视频微课。"
        elif "测验" in user_message or "quiz" in user_message:
            bot_reply = "上次测验中，全班在'关联规则'知识点上平均得分较低（65%）。建议下节课重点回顾 Apriori 算法原理。"
        else:
            bot_reply = "这是一个很好的问题！作为您的 AI 助教，我可以帮您分析学生行为数据、生成个性化教案或解答课程相关问题。"

    return jsonify({'reply': bot_reply})
