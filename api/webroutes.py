from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse

# Initialize router
router = APIRouter()

# Initialize templates
templates = Jinja2Templates(directory="templates")

@router.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """
    Serve the main banking dashboard page
    """
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    """
    Alternative route for the dashboard
    """
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/accounts", response_class=HTMLResponse)
async def accounts(request: Request):
    """
    Account management page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show detailed account information
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "My Accounts",
        "active_section": "accounts"
    })

@router.get("/transfer", response_class=HTMLResponse)
async def transfer(request: Request):
    """
    Money transfer page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show the transfer form
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Transfer Money",
        "active_section": "transfer"
    })

@router.get("/payments", response_class=HTMLResponse)
async def payments(request: Request):
    """
    Bill payments page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show bill payment options
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Pay Bills",
        "active_section": "payments"
    })

@router.get("/transactions", response_class=HTMLResponse)
async def transactions(request: Request):
    """
    Transaction history page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show detailed transaction history
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Transaction History",
        "active_section": "transactions"
    })

@router.get("/statements", response_class=HTMLResponse)
async def statements(request: Request):
    """
    Account statements page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show downloadable statements
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Statements",
        "active_section": "statements"
    })

@router.get("/investments", response_class=HTMLResponse)
async def investments(request: Request):
    """
    Investment portfolio page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show investment portfolio
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Investments",
        "active_section": "investments"
    })

@router.get("/help", response_class=HTMLResponse)
async def help_center(request: Request):
    """
    Help center page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show help documentation
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Help Center",
        "active_section": "help"
    })

@router.get("/contact", response_class=HTMLResponse)
async def contact(request: Request):
    """
    Contact us page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show contact information and forms
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Contact Us",
        "active_section": "contact"
    })

@router.get("/security", response_class=HTMLResponse)
async def security(request: Request):
    """
    Security center page (placeholder)
    """
    # For now, redirect to main dashboard
    # In a real app, this would show security settings and tips
    return templates.TemplateResponse("index.html", {
        "request": request,
        "page_title": "Security Center",
        "active_section": "security"
    })

@router.get("/prompt", response_class=HTMLResponse)
async def claude_assistant(request: Request):
    """
    Claude AI Assistant chat interface
    """
    return templates.TemplateResponse("prompt.html", {
        "request": request,
        "page_title": "Claude AI Assistant",
        "active_section": "assistant"
    })
